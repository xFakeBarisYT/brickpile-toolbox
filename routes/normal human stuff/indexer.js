const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { Readable } = require("stream");
//require("dotenv").config();

const indexrouter = express.Router();

const upload = multer({
  limits: {
    fileSize: Number(process.env.Upload_KBLimit) * 1024,
  },
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// Check if upload directory exists, if not create it
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Get metadata for verified BRK files - API endpoint for toolbox client
indexrouter.get("/read", async (req, res) => {
  const { title, index = 0 } = req.query;
  const pageSize = 18;
  const offset = index * pageSize;

  let query = supabase.from("brk_files").select("*").eq("verified", true);

  if (title) {
    query = query.or(`title.ilike.%${title}%,description.ilike.%${title}%`);
  }
  query = query
    .order("upload_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error } = await query;
  console.log(data);
  if (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }

  try {
    // Return metadata - no direct Supabase URLs, only IDs
    const responseData = data.map(item => ({
      id: item.id,
      username: item.username,
      title: item.title,
      description: item.description,
      upload_date: item.upload_date,
      has_thumbnail: !!item.thumbnail_url
    }));

    res.json(responseData);
  } catch (fetchError) {
    console.error(fetchError);
    res.status(500).send("Error fetching file metadata");
  }
});

// Secure thumbnail endpoint - serves thumbnails via backend
indexrouter.get("/thumbnail/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("brk_files")
    .select("thumbnail_url")
    .eq("id", id)
    .eq("verified", true)
    .single();

  if (error || !data?.thumbnail_url) {
    // Generate thumbnail from BRK content
    let thumbnailBuffer;
    try {
      const brkContent = dataa.buffer.toString('utf-8');
      thumbnailBuffer = await generateBrkThumbnail(brkContent, 256, 256);
    } catch (thumbError) {
      console.error("Thumbnail generation failed, continuing without thumbnail:", thumbError);
      thumbnailBuffer = null;
    }
    // Upload thumbnail if generated successfully
    let thumbnailUrl = null;
    if (thumbnailBuffer) {
      const { error: thumbUploadError } = await supabase.storage
        .from("brk-files")
        .upload(thumbnailFileName, thumbnailBuffer, {
          contentType: "image/png",
        });

      if (!thumbUploadError) {
        const { data: thumbData } = supabase.storage
          .from("brk-files")
          .getPublicUrl(thumbnailFileName);
        data.thumbnail_url = thumbData.publicUrl;
      }
      if (!thumbnailUrl) {
        return res.status(404).send("Thumbnail not found");
      }
    }
  }

  try {
    const response = await fetch(data.thumbnail_url);

    if (!response.ok) {
      return res.status(500).send("Failed to fetch thumbnail");
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");

    // 🔥 convert Web Stream → Node Stream
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Error loading thumbnail");
  }
});

// Secure download endpoint - file is not loaded into URL
indexrouter.get("/download/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("brk_files")
    .select("file_url, title")
    .eq("id", id)
    .eq("verified", true)
    .single();

  if (error || !data?.file_url) {
    return res.status(404).send("File not found or not verified");
  }

  try {
    const response = await fetch(data.file_url);

    if (!response.ok) {
      return res.status(500).send("Failed to fetch file");
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.title}.brk"`
    );
    res.setHeader("Cache-Control", "no-store");

    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);

  } catch (err) {
    console.error("Download proxy error:", err);
    res.status(500).send("Error downloading file");
  }
});

module.exports = indexrouter;