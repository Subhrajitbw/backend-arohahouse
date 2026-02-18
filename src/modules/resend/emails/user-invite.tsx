import { Button, Heading, Text } from "@react-email/components"
import EmailLayout, { EmailLayoutProps } from "./components/EmailLayout"

type InviteEmailProps = EmailLayoutProps & {
  invite: {
    email: string
    token: string
    expires_at?: string | Date
  }
  invite_url: string
}

const AdminInviteEmail = ({ invite, invite_url, ...layout }: InviteEmailProps) => {
  return (
    <EmailLayout {...layout}>
      <Heading>You're invited to join the admin</Heading>
      <Text>
        Use the button below to accept your invite and set your password.
      </Text>
      <Button href={invite_url}>Accept invite</Button>
      <Text>
        This invite was sent to {invite.email}. If you weren&apos;t expecting
        this, you can ignore this email.
      </Text>
    </EmailLayout>
  )
}

AdminInviteEmail.PreviewProps = {
  invite: {
    email: "admin@example.com",
    token: "example-token",
  },
  invite_url: "http://localhost:9000/app/invite?token=example-token",
}

export default AdminInviteEmail
