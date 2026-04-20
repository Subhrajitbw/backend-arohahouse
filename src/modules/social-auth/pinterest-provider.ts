import {
  AbstractAuthModuleProvider,
} from "@medusajs/framework/utils"
import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from "@medusajs/framework/types"
import axios from "axios"

class PinterestAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "pinterest"
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
      error: "Redirect to Pinterest or use callback logic",
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
      const authHeader = Buffer.from(
        `${this.options_.clientId}:${this.options_.clientSecret}`
      ).toString("base64")

      const tokenResponse = await axios.post(
        "https://api.pinterest.com/v5/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.options_.callbackUrl,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${authHeader}`,
          },
        }
      )

      const accessToken = tokenResponse.data.access_token

      const userResponse = await axios.get("https://api.pinterest.com/v5/user_account", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const userInfo = userResponse.data
      const entityId = userInfo.username || userInfo.id

      let authIdentity
      try {
        authIdentity = await authIdentityProviderService.retrieve({
          entity_id: entityId,
        })
      } catch (error) {
        authIdentity = await authIdentityProviderService.create({
          entity_id: entityId,
          user_metadata: {
            username: userInfo.username,
            profile_image: userInfo.profile_image,
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

export default PinterestAuthProviderService
