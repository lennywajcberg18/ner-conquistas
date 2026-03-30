const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { type, memberName, activity, pts, name, email, msg } = await req.json()
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
  const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@nerIsrael.com'
  const APP_URL = Deno.env.get('APP_URL') || 'https://seuapp.vercel.app'

  if (RESEND_KEY) {
    let subject = '', html = ''
    if (type === 'points') {
      subject = `📬 Nova solicitação de pontos — ${memberName}`
      html = `<p><strong>${memberName}</strong> solicitou <strong>+${pts} pontos</strong>.<br>Atividade: ${activity}</p><p><a href="${APP_URL}">Abrir painel admin →</a></p>`
    } else if (type === 'redeem') {
      subject = `🎁 Solicitação de resgate — ${memberName}`
      html = `<p><strong>${memberName}</strong> solicitou resgate: <strong>${activity}</strong> (${pts} pts).</p><p><a href="${APP_URL}">Abrir painel admin →</a></p>`
    } else if (type === 'invite') {
      subject = `📩 Novo pedido de convite — ${name}`
      html = `<p><strong>${name}</strong> (${email}) quer participar do programa.</p>${msg ? `<p>Mensagem: "${msg}"</p>` : ''}<p><a href="${APP_URL}">Abrir painel admin →</a></p>`
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Ner Israel <noreply@conquistasner.com.br>', to: [ADMIN_EMAIL], subject, html })
    })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
