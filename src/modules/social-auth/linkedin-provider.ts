import {
  AbstractAuthModuleProvider,
} from "@medusajs/framework/utils"
import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from "@medusajs/framework/types"
import axios from "axios"

class LinkedInAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "linkedin"
  protected options_: any

  constructor(container: any, options: any) {
    super()
    this.options_ = options
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return {
      success: false,
      error: "Redirect to LinkedIn or use callback logic",
    }
  }

  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const { code } = data.query as { code: string }

    if (!code) {
      return {
        success: false,
        error: "No code provided",
      }
    }

    try {
      // 1. Exchange code for access token
      const tokenResponse = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: this.options_.clientId,
          client_secret: this.options_.clientSecret,
          redirect_uri: this.options_.callbackUrl,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )

      const accessToken = tokenResponse.data.access_token

      // 2. Fetch user profile
      const userResponse = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const userInfo = userResponse.data
      const entityId = userInfo.sub || userInfo.email

      // 3. Retrieve or create Auth Identity
      let authIdentity: any
      try {
        authIdentity = await authIdentityProviderService.retrieve({
          entity_id: entityId,
        })
      } catch (error) {
        authIdentity = await authIdentityProviderService.create({
          entity_id: entityId,
          user_metadata: {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          },
        })
      }

      return {
        success: true,
        authIdentity,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }
}

export default LinkedInAuthProviderService
