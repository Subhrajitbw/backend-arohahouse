import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules, UserEvents } from "@medusajs/framework/utils"

type InvitePayload = {
  id: string | string[]
}

const resolveAdminInviteUrl = (token: string) => {
  const adminUrl =
    process.env.ADMIN_DASHBOARD_URL ||
    process.env.MEDUSA_ADMIN_URL ||
    (process.env.MEDUSA_BACKEND_URL
      ? `${process.env.MEDUSA_BACKEND_URL.replace(/\/$/, "")}/app`
      : "http://localhost:9000/app")

  return `${adminUrl.replace(/\/$/, "")}/invite?token=${encodeURIComponent(
    token
  )}`
}

export default async function sendAdminInviteNotification({
  event: { data },
  container,
}: SubscriberArgs<InvitePayload | InvitePayload[]>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userModule = container.resolve(Modules.USER) as any

  const payloads = Array.isArray(data) ? data : [data]
  const ids = payloads
    .flatMap((payload) => (Array.isArray(payload.id) ? payload.id : [payload.id]))
    .filter(Boolean)

  if (!ids.length) {
    logger.info("Invite notification skipped: no invite ids in event payload.")
    return
  }

  let invites: Array<{
    id: string
    email: string
    token: string
    expires_at?: string | Date
  }> = []

  if (typeof userModule.listInvites === "function") {
    invites = await userModule.listInvites({ id: ids })
  } else {
    const invite = await userModule.retrieveInvite(ids[0])
    invites = invite ? [invite] : []
  }

  if (!invites.length) {
    logger.info(`Invite notification skipped: no invites found for ${ids.join(",")}`)
    return
  }

  for (const invite of invites) {
    if (!invite?.email || !invite?.token) {
      logger.info(`Invite notification skipped: missing email/token for ${invite?.id}`)
      continue
    }

    logger.info(
      `Sending admin invite email to ${invite.email} (invite ${invite.id})`
    )
    await notificationModuleService.createNotifications({
      to: invite.email,
      channel: "email",
      template: "user-invite",
      data: {
        invite: {
          email: invite.email,
          token: invite.token,
          expires_at: invite.expires_at,
        },
        invite_url: resolveAdminInviteUrl(invite.token),
      },
    })
  }
}

export const config: SubscriberConfig = {
  event: UserEvents.INVITE_TOKEN_GENERATED,
}
