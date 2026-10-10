/* =====================================================================
   Bora pra Faxina! — envio dos lembretes (roda no GitHub Actions)

   A cada execução:
   1. busca no Firestore os aparelhos com lembrete vencido (campo "proximo");
   2. confere a casa, conta as tarefas pendentes do dia e monta a mensagem;
   3. envia pelo Firebase Cloud Messaging e agenda o próximo horário.

   Variável de ambiente obrigatória:
   FIREBASE_SERVICE_ACCOUNT → conteúdo do JSON da conta de serviço do Firebase
   ===================================================================== */

const JANELA = 2 * 60 * 60 * 1000; // envia lembretes atrasados em até 2h (o GitHub às vezes atrasa)
// Antecipação: envia o que vence nos próximos minutos, para compensar o atraso do GitHub
const ANTECEDENCIA = (Number(process.env.ANTECEDENCIA_MIN) || 3) * 60 * 1000;

const pad = n => String(n).padStart(2, '0');
const ymdUTC = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/* ---------- horários no fuso de cada aparelho (mesma conta do app) ---------- */
function tzOff(ms, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
function zoned(y, m, d, h, mi, tz) {
  const g = Date.UTC(y, m - 1, d, h, mi); const o = tzOff(g, tz); let r = g - o;
  const o2 = tzOff(r, tz); if (o2 !== o) r = g - o2; return r;
}
function localYMD(ms, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
  return [+p.year, +p.month, +p.day];
}
function ocorrencias(lem, tz, de, ate) {
  const out = []; const [y, m, d] = localYMD(de, tz);
  const [hh, mm] = String(lem.hora || '08:00').split(':').map(Number);
  const dias = lem.tipo === 'mensal' ? [5] : (lem.dias || []);
  const n = Math.ceil((ate - de) / 864e5) + 1;
  for (let k = -1; k <= n; k++) {
    const dt = new Date(Date.UTC(y, m - 1, d + k)); const wd = (dt.getUTCDay() + 6) % 7;
    if (!dias.includes(wd)) continue;
    const Y = dt.getUTCFullYear(), M = dt.getUTCMonth() + 1, D = dt.getUTCDate();
    const ms = zoned(Y, M, D, hh, mm, tz);
    if (ms >= de && ms <= ate) out.push({ ms, data: `${Y}-${pad(M)}-${pad(D)}`, wd, Y, M, D, hh });
  }
  return out.sort((a, b) => a.ms - b.ms);
}
function proximoEnvio(lems, tz, de) {
  let best = null;
  (lems || []).filter(l => l.ativo).forEach(l => {
    const o = ocorrencias(l, tz, de, de + 9 * 864e5)[0];
    if (o && (best === null || o.ms < best)) best = o.ms;
  });
  return best;
}
function ultimoSabado(y, m) {
  const last = new Date(Date.UTC(y, m, 0));
  return last.getUTCDate() - ((last.getUTCDay() + 1) % 7);
}

/* ---------- contagem das tarefas (mesma regra do app) ---------- */
function contar(cfg, sem, wd, weekId, inicio) {
  const rooms = cfg.rooms || {}, sched = cfg.sched || {}, ch = sem.checks || {};
  const dia = i => {
    let a = 0, b = 0;
    (sched['d' + i] || []).forEach(rid => {
      const r = rooms[rid]; if (!r) return;
      (r.items || []).forEach(it => { b++; if (ch[`${i}|${rid}|${it.id}`]) a++; });
    });
    return [a, b];
  };
  const [a, b] = dia(wd);
  const [Y, M, D] = weekId.split('-').map(Number);
  let atrasadas = 0;
  for (let i = 0; i < wd; i++) {
    const di = ymdUTC(new Date(Date.UTC(Y, M - 1, D + i)));
    if (inicio && di < inicio) continue;
    const [x, y] = dia(i); atrasadas += y - x;
  }
  atrasadas += (sem.carried || []).filter(c => !c.done).length;
  const tema = (sched['d' + wd] || []).filter(r => r !== 'manut').map(r => rooms[r] && rooms[r].name).filter(Boolean).join(' + ') || 'Manutenção';
  return { pend: b - a, total: b, atrasadas, tema, pct: b ? Math.round(a / b * 100) : 0 };
}

/* ---------- textos ---------- */
async function montar(lem, occ, disp, casa, ler) {
  const cfg = casa.config || {};
  const pessoa = (cfg.people || []).find(p => p.id === disp.pessoa);
  const nome = pessoa ? pessoa.name : '';
  const tag = 'bpf-' + lem.tipo;

  if (lem.tipo === 'livre') return { title: casa.nome || 'Bora pra Faxina!', body: lem.msg || 'Hora da faxina! 🧹', tag: 'bpf-livre-' + lem.id };

  if (lem.tipo === 'mensal') {
    const mes = (await ler(`casas/${disp.casaId}/meses/${occ.Y}-${pad(occ.M)}`)) || {};
    const sab = mes.sat || ultimoSabado(occ.Y, occ.M);
    if (occ.D !== sab) return null;
    const itens = (cfg.rooms && cfg.rooms.mensal && cfg.rooms.mensal.items) || [];
    const feitos = itens.filter(it => (mes.checks || {})[`M|mensal|${it.id}`]).length;
    if (!itens.length || feitos === itens.length) return null;
    return { title: 'Hoje é o sábado da faxina pesada! ✨', body: `${nome ? nome + ', faltam' : 'Faltam'} ${plural(itens.length - feitos, 'item', 'itens')} no checklist do mês. Bora?`, tag };
  }

  const seg = new Date(Date.UTC(occ.Y, occ.M - 1, occ.D - occ.wd));
  const weekId = ymdUTC(seg);
  const sem = (await ler(`casas/${disp.casaId}/semanas/${weekId}`)) || {};
  const c = contar(cfg, sem, occ.wd, weekId, casa.inicio);
  const atr = c.atrasadas ? ` · ${plural(c.atrasadas, 'atrasada', 'atrasadas')}` : '';

  if (lem.tipo === 'dia') {
    if (c.total === 0 || (c.pend === 0 && c.atrasadas === 0)) return null;
    const saud = occ.hh < 12 ? 'Bom dia' : occ.hh < 18 ? 'Boa tarde' : 'Boa noite';
    return { title: `${saud}${nome ? ', ' + nome : ''}! Hoje é dia de ${c.tema}`, body: `${plural(c.pend, 'tarefa', 'tarefas')} para hoje${atr}. Bora pra faxina? 🧹`, tag };
  }
  if (lem.tipo === 'pendentes') {
    if (c.pend === 0 && c.atrasadas === 0) return null;
    if (c.pend > 0) return { title: `Falta${c.pend === 1 ? '' : 'm'} ${plural(c.pend, 'tarefa', 'tarefas')} de hoje`, body: `${c.tema}: ${c.pct}% concluído${atr}. Um pouquinho de cada vez! 💪`, tag };
    return { title: `${plural(c.atrasadas, 'tarefa atrasada', 'tarefas atrasadas')}`, body: 'As de hoje já foram! Que tal adiantar as atrasadas? 💪', tag };
  }
  return null;
}

/* ---------- execução ---------- */
async function rodar({ db, messaging, agora = Date.now(), log = console.log, antecedencia = ANTECEDENCIA }) {
  const limite = agora + antecedencia;
  const cache = new Map();
  const ler = async path => {
    if (!cache.has(path)) cache.set(path, db.doc(path).get().then(s => (s.exists ? s.data() : null)));
    return cache.get(path);
  };
  const snap = await db.collection('dispositivos').where('proximo', '<=', limite).get();
  log(`Agora em São Paulo: ${new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  log(`${snap.size} aparelho(s) com lembrete vencido`);
  const tot = { enviados: 0, pulados: 0, removidos: 0, erros: 0 };

  for (const doc of snap.docs) {
    const d = doc.data();
    const tz = d.tz || 'America/Sao_Paulo';
    try {
      if (!d.ativo || !d.token) { await doc.ref.update({ proximo: null }); continue; }
      const casa = await ler(`casas/${d.casaId}`);
      if (!casa || !(casa.membros || []).includes(d.uid)) { await doc.ref.delete(); tot.removidos++; continue; }

      let removido = false;
      const enviar = async msg => {
        if (removido) return;
        try {
          await messaging.send({
            token: d.token,
            data: { title: msg.title, body: msg.body, tag: msg.tag || 'bpf', url: d.app || './' },
            webpush: { headers: { Urgency: 'high', TTL: '7200' } }
          });
          tot.enviados++;
        } catch (e) {
          const code = (e && (e.code || (e.errorInfo && e.errorInfo.code))) || '';
          if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
            await doc.ref.delete(); removido = true; tot.removidos++;
          } else { tot.erros++; log('erro ao enviar', doc.id, code || e.message); }
        }
      };

      const upd = {};
      if (d.teste) {
        await enviar({ title: '🔔 Teste do Bora pra Faxina!', body: 'As notificações do servidor estão funcionando neste aparelho.', tag: 'bpf-teste' });
        upd.teste = false;
      }
      for (const lem of (d.lembretes || []).filter(l => l.ativo)) {
        for (const occ of ocorrencias(lem, tz, agora - JANELA, limite)) {
          // a marca inclui a hora: se o horário do lembrete for alterado, ele volta a valer no mesmo dia
          const marca = `${occ.data} ${lem.hora}`;
          if ((d.ultimos || {})[lem.id] === marca) continue;
          upd[`ultimos.${lem.id}`] = marca;
          const msg = await montar(lem, occ, d, casa, ler);
          if (msg) { await enviar(msg); log(`  ${doc.id} · ${lem.hora} ${lem.tipo}: enviado`); }
          else { tot.pulados++; log(`  ${doc.id} · ${lem.hora} ${lem.tipo}: sem necessidade (nada pendente ou não é o dia)`); }
        }
      }
      if (removido) continue;
      upd.proximo = proximoEnvio(d.lembretes, tz, limite + 1);
      await doc.ref.update(upd);
    } catch (e) {
      tot.erros++; log('erro no aparelho', doc.id, e.message);
    }
  }
  log(`enviados: ${tot.enviados} · sem necessidade: ${tot.pulados} · removidos: ${tot.removidos} · erros: ${tot.erros}`);
  try {
    const prox = await db.collection('dispositivos').where('proximo', '>', limite).orderBy('proximo').limit(3).get();
    prox.docs.forEach(x => log(`próximo: ${x.id} às ${new Date(x.data().proximo).toLocaleString('pt-BR', { timeZone: x.data().tz || 'America/Sao_Paulo' })}`));
  } catch (e) { /* só informativo */ }
  return tot;
}

module.exports = { rodar, ocorrencias, proximoEnvio, contar, montar, ultimoSabado };

if (require.main === module) {
  const admin = require('firebase-admin');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub (veja o README).'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  rodar({ db: admin.firestore(), messaging: admin.messaging() })
    .then(t => process.exit(t.erros && !t.enviados ? 1 : 0))
    .catch(e => { console.error(e); process.exit(1); });
}
