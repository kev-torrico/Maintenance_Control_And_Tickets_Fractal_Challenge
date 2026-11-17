import { apiClient } from "@/services/apiClient"

export const boardService = {
  /** GET /boards — active boards. */
  async getBoards() {
    const { data } = await apiClient.get("/boards")
    return data
  },

  /** GET /boards/:id — ordered lists with nested, ordered tickets. */
  async getBoard(boardId, options) {
    const { data } = await apiClient.get(`/boards/${boardId}`, options)
    return data
  },

  /** GET /boards/assets — registered asset codes. */
  async getAssets(search) {
    const { data } = await apiClient.get("/boards/assets", { params: { search } })
    return data
  },
}
