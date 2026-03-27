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
      await sendEmail(inv.email, '🎉 Bem-vindo ao Programa de Conquistas — Ner Israel!',
        `<p>Olá ${inv.name}!</p><p>Seu acesso foi aprovado!</p><p><strong>Email:</strong> ${inv.email}<br><strong>Senha:</strong> ${tempPassword}</p><p>Acesse: <a href="${APP_URL}" style="background:#C9A84C;color:#0B1623;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Entrar no sistema →</a></p>`)
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ── REJECT INVITE ──
  if (action === 'reject_invite') {
    const { data: inv } = await db.from('invite_requests').select('*').eq('id', inviteId).single()
    await db.from('invite_requests').update({ status: 'rejected' }).eq('id', inviteId)
    await sendEmail(inv.email, 'Solicitação de acesso — Ner Israel',
      `<p>Olá ${inv.name}, infelizmente sua solicitação de acesso ao Programa de Conquistas não foi aprovada. Entre em contato com a sinagoga para mais informações.</p>`)
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
