import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')!

  // Verify user is admin
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: cors })

  // Use service role for admin operations
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: adminProfile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!adminProfile?.is_admin) return new Response('Forbidden', { status: 403, headers: cors })

  const body = await req.json()
  const { action, requestId, inviteId } = body
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
  const APP_URL = Deno.env.get('APP_URL') || 'https://seuapp.vercel.app'

  const sendEmail = async (to: string, subject: string, html: string) => {
    if (!RESEND_KEY) return
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Ner Israel <onboarding@resend.dev>', to: [to], subject, html })
    })
  }

  // ── GET ALL DATA ──
  if (action === 'get_all') {
    const [reqs, invites, members] = await Promise.all([
      db.from('requests').select('*').order('created_at', { ascending: false }),
      db.from('invite_requests').select('*').order('created_at', { ascending: false }),
      db.from('profiles').select('*').order('pts', { ascending: false }),
    ])
    return new Response(JSON.stringify({
      requests: reqs.data, invites: invites.data, members: members.data
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── APPROVE REQUEST (points or redeem) ──
  if (action === 'approve_request') {
    const { data: r } = await db.from('requests').select('*').eq('id', requestId).single()
    await db.from('requests').update({ status: 'approved' }).eq('id', requestId)
    const { data: p } = await db.from('profiles').select('pts, email').eq('id', r.member_id).single()

    if (r.type === 'points') {
      await db.from('profiles').update({ pts: p.pts + r.pts }).eq('id', r.member_id)
      await sendEmail(p.email, `✅ ${r.pts} pontos aprovados!`,
        `<p>Olá ${r.member_name}!</p><p>Sua solicitação de <strong>+${r.pts} pontos</strong> foi aprovada!</p><p>Atividade: ${r.activity}</p><p>Acesse o programa: <a href="${APP_URL}">${APP_URL}</a></p>`)
    } else {
      await db.from('profiles').update({ pts: Math.max(0, p.pts - r.pts) }).eq('id', r.member_id)
      await sendEmail(p.email, `🎁 Resgate aprovado!`,
        `<p>Olá ${r.member_name}!</p><p>Seu resgate foi aprovado!</p><p>Item: ${r.activity}</p><p>Pontos debitados: ${r.pts}</p>`)
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── REJECT REQUEST ──
  if (action === 'reject_request') {
    const { data: r } = await db.from('requests').select('*').eq('id', requestId).single()
    await db.from('requests').update({ status: 'rejected' }).eq('id', requestId)
    const { data: p } = await db.from('profiles').select('email').eq('id', r.member_id).single()
    await sendEmail(p.email, `Solicitação não aprovada`,
      `<p>Olá ${r.member_name}, sua solicitação de ${r.type === 'points' ? '+' + r.pts + ' pts' : 'resgate'} não foi aprovada desta vez. Entre em contato com o admin para mais informações.</p>`)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── APPROVE INVITE (creates user with password and sends email) ──
  if (action === 'approve_invite') {
    const { data: inv } = await db.from('invite_requests').select('*').eq('id', inviteId).single()
    const tempPassword = inv.name.trim().split(' ')[0].toLowerCase() + '2026'
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: inv.email, password: tempPassword, email_confirm: true
    })
    if (!authError && authData.user) {
      const ini = inv.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      await db.from('profiles').insert({ id: authData.user.id, name: inv.name, email: inv.email, ini, pts: 0, is_admin: false })
      await db.from('invite_requests').update({ status: 'approved' }).eq('id', inviteId)
      await sendEmail(inv.email, 'Parabens! Voce foi aprovado no Programa de Conquistas — Ner Israel',
        `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0B1623;color:#F0F4FA;padding:40px 30px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="color:#C9A84C;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Sinagoga Ner Israel</div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 6px;color:#F0F4FA;">Programa de Conquistas</h1>
          </div>
          <p style="font-size:16px;line-height:1.6;">Ola <strong>${inv.name}</strong>!</p>
          <p style="font-size:15px;line-height:1.6;">Parabens! Sua solicitacao foi aprovada. Voce agora faz parte do <strong style="color:#C9A84C;">Programa de Conquistas</strong> do Ner Israel.</p>
          <p style="font-size:15px;line-height:1.6;">Participe das atividades, acumule pontos e troque por premios incriveis!</p>
          <div style="background:#111E2E;border:1px solid #1C2E45;border-radius:10px;padding:20px;margin:24px 0;">
            <div style="font-size:11px;color:#6B7FA0;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Seus dados de acesso</div>
            <p style="margin:0 0 6px;font-size:14px;"><strong style="color:#6B7FA0;">Email:</strong> <span style="color:#C9A84C;">${inv.email}</span></p>
            <p style="margin:0;font-size:14px;"><strong style="color:#6B7FA0;">Senha:</strong> <span style="color:#C9A84C;">${tempPassword}</span></p>
          </div>
          <div style="text-align:center;margin-top:28px;">
            <a href="${APP_URL}" style="background:linear-gradient(135deg,#C9A84C,#E2C57A);color:#0B1623;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;display:inline-block;">Acessar o sistema</a>
          </div>
          <p style="font-size:11px;color:#6B7FA0;text-align:center;margin-top:24px;">Recomendamos que voce troque sua senha apos o primeiro acesso.</p>
        </div>`)
    }
    return new Response(JSON.stringify({ ok: true, password: tempPassword, name: inv.name }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── REJECT INVITE ──
  if (action === 'reject_invite') {
    const { data: inv } = await db.from('invite_requests').select('*').eq('id', inviteId).single()
    await db.from('invite_requests').update({ status: 'rejected' }).eq('id', inviteId)
    await sendEmail(inv.email, 'Solicitação de acesso — Ner Israel',
      `<p>Olá ${inv.name}, infelizmente sua solicitação de acesso ao Programa de Conquistas não foi aprovada. Entre em contato com a sinagoga para mais informações.</p>`)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── REMOVE MEMBER ──
  if (action === 'remove_member') {
    const { memberId } = body
    await db.from('requests').delete().eq('member_id', memberId)
    await db.from('profiles').delete().eq('id', memberId)
    await db.auth.admin.deleteUser(memberId)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── SET PASSWORD (admin sets own password) ──
  if (action === 'set_password') {
    const { password } = body
    const { error } = await db.auth.admin.updateUserById(user.id, { password })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  return new Response('Unknown action', { status: 400, headers: cors })
})
