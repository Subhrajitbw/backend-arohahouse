const axios = require("axios")

const BASE_URL = "http://localhost:9000"
const KEEP_ID = "prod_01KHDBWRMMYZP0VPXGEJTG6CWG"

const ADMIN_EMAIL = "admin@arohahouse.com"
const ADMIN_PASSWORD = "Saltlake4@123"

async function run() {
  try {
    // 1️⃣ Login using correct v2 endpoint
    const loginRes = await axios.post(
      `${BASE_URL}/admin/auth/emailpass`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      { withCredentials: true }
    )

    const token = loginRes.data.token

    if (!token) {
      throw new Error("Login failed — no token returned")
    }

    console.log("✅ Logged in successfully")

    const api = axios.create({
      baseURL: `${BASE_URL}/admin`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    // 2️⃣ Fetch products
    let limit = 100
    let offset = 0
    let allProducts = []
    let hasMore = true

    while (hasMore) {
      const res = await api.get(`/products?limit=${limit}&offset=${offset}`)
      const { products } = res.data

      if (!products.length) {
        hasMore = false
      } else {
        allProducts.push(...products)
        offset += products.length
        if (products.length < limit) hasMore = false
      }
    }

    console.log(`Total products found: ${allProducts.length}`)

    const toDelete = allProducts.filter(p => p.id !== KEEP_ID)
    console.log(`Deleting ${toDelete.length} products...`)

    for (const p of toDelete) {
      await api.delete(`/products/${p.id}`)
      console.log(`Deleted: ${p.id}`)
    }

    console.log(`\n🎉 Done! Only ${KEEP_ID} remains.`)

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message)
  }
}

run()