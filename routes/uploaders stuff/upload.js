const express = require("express");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const { router, client, sendUserData, sendMessageToOwner } = require('../normal human stuff/discord.js');
const { generateBrkThumbnail } = require('./thumbnail-generator');
//require("dotenv").config();

const uploadrouter = express.Router();

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

// File upload route

uploadrouter.post("/upload", upload.single("brkFile"), async (req, res) => {
  const { username, title, description } = req.body;
  const dataa = req.file;

  // Validate required fields
  if (!username || !title || !description) {
    return res.status(400).send("Missing required fields.");
  }

  const usernameLimit = 20;
  const titleLimit = 40;
  const descriptionLimit = 200;

  if (username.length > usernameLimit) {
    return res
      .status(400)
      .send(`Username must be ${usernameLimit} characters or less.`);
  }

  if (title.length > titleLimit) {
    return res
      .status(400)
      .send(`Title must be ${titleLimit} characters or less.`);
  }

  if (description.length > descriptionLimit) {
    return res
      .status(400)
      .send(`Description must be ${descriptionLimit} characters or less.`);
  }

  if (!dataa) {
    return res.status(400).send("No file uploaded.");
  }

  // Validate file type
  const allowedTypes = [
    "application/octet-stream",
    "application/x-binary",
    "application/x-brk",
  ];
  if (!allowedTypes.includes(dataa.mimetype)) {
    return res
      .status(400)
      .send("Invalid file type. Only .brk files are allowed.");
  }

  const fileName = `${uuidv4()}-${dataa.originalname}`;
  const thumbnailFileName = `thumb-${fileName.replace('.brk', '.png')}`;

  try {
    // Generate thumbnail from BRK content
    let thumbnailBuffer;
    try {
      const brkContent = dataa.buffer.toString('utf-8');
      thumbnailBuffer = await generateBrkThumbnail(brkContent, 256, 256);
    } catch (thumbError) {
      console.error("Thumbnail generation failed, continuing without thumbnail:", thumbError);
      thumbnailBuffer = null;
    }

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("brk-files")
      .upload(fileName, dataa.buffer, {
        contentType: dataa.mimetype,
      });

    if (uploadError) {
      console.error(uploadError);
      return res.status(500).send(uploadError.message);
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
        thumbnailUrl = thumbData.publicUrl;
      }
    }

    // Get the public URL for the uploaded file
    const { data } = supabase.storage.from("brk-files").getPublicUrl(fileName);

    // Insert metadata into the Supabase `brk_files` table
    const { data: insertData, error: dbError } = await supabase
      .from("brk_files")
      .insert([
        {
          username,
          title,
          description,
          file_url: data.publicUrl,
          thumbnail_url: thumbnailUrl,
          upload_date: new Date(),
          verified: false,
        },
      ])
      .select("id");

    if (dbError) {
      console.error(dbError);
      return res.status(500).send(dbError.message);
    }

    // Ensure insertData is not null, is an array, and has at least one element
    if (insertData && Array.isArray(insertData) && insertData.length > 0) {
      const insertedId = insertData[0].id;
      sendMessageToOwner(
        username +
          " Uploaded model \nName: " +
          title +
          "\nId: (" +
          insertedId +
          ")\n" +
          data.publicUrl
      );
    }
    res.send(
      "File uploaded and metadata saved. Wait until it's verified by moderators"
    );
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).send("An error occurred during upload");
  }
});

uploadrouter.post("/uploadscript", async (req, res) => {
  const { title, username, description, content } = req.body;
  // Example: Log the received data

  if (!title || !username || !description || !content) {
    return res.status(400).send("Missing required fields");
  }

  const usernameLimit = 20;
  const titleLimit = 40;
  const descriptionLimit = 500;

  if (username.length > usernameLimit) {
    return res
      .status(400)
      .send(`Username must be ${usernameLimit} characters or less.`);
  }

  if (title.length > titleLimit) {
    return res
      .status(400)
      .send(`Title must be ${titleLimit} characters or less.`);
  }

  if (description.length > descriptionLimit) {
    return res
      .status(400)
      .send(`Description must be ${descriptionLimit} characters or less.`);
  }

  const fileName = `${uuidv4()}-${title}`;
  const buffer = Buffer.from(content, "utf-8");
  // Upload the file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("brk-files") // Your bucket name
    .upload(fileName, buffer, {
      contentType: "application/javascript", // Set the correct MIME type
    });

  if (uploadError) {
    console.error(uploadError);
    return res.status(500).send(uploadError.message);
  }

  const { data } = supabase.storage.from("brk-files").getPublicUrl(fileName);

  const { data: insertData, error: dbError } = await supabase
    .from("script_files")
    .insert([
      {
        username,
        title,
        description,
        file_url: data.publicUrl,
        upload_date: new Date(),
        verified: false,
      },
    ])
    .select("id");

  if (dbError) {
    console.error(dbError);
    return res.status(500).send(dbError.message);
  }

  if (insertData && Array.isArray(insertData) && insertData.length > 0) {
    const insertedId = insertData[0].id; // Access the ID of the first inserted row
    sendMessageToOwner(
      username +
        " Uploaded a script \nName: " +
        title +
        "\nId: (" +
        insertedId +
        ")\n" +
        data.publicUrl
    );
  }
  res.send(
    "File uploaded and metadata saved. Wait until it's verified by moderators"
  );
});


module.exports = uploadrouter;