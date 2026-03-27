export default async function handler(req: any, res: any) {
  try {
    return res.status(200).json({ message: "Backend working macha 🔥" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}