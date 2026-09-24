import fs from "fs";
import path from "path";

export const downloadSite = async (req, res) => {
  const { id } = req.params;
  const zipsDir = path.join(process.cwd(), "uploads", "zips");
  const zipPath = path.join(zipsDir, `${id}.zip`);

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ success: false, message: "Zip file not found" });
  }

  res.download(zipPath, `site-${id}.zip`);
};
