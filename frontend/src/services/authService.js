import { apiClient } from "@/services/apiClient"

export const authService = {
  /** GET /auth/users — users with their board roles (optional role filter). */
  async getUsers(role) {
    const { data } = await apiClient.get("/auth/users", { params: { role } })
    return data
  },

  /** POST /auth/login — { email } */
  async login(email) {
    const { data } = await apiClient.post("/auth/login", { email })
    return data
  },

  /** POST /auth/register — { full_name, email, role } */
  async register({ fullName, email, role }) {
    const { data } = await apiClient.post("/auth/register", { full_name: fullName, email, role })
    return data
  },
}
