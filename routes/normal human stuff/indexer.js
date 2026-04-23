const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

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

indexrouter.get("/read", async (req, res) => {
  const { title, index = 0 } = req.query;
  const pageSize = 18;
  const offset = index * pageSize;

  let query = supabase.from("brk_files").select("*").eq("verified", true); // Add the `verified` condition here

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
    // Fetch the file content for each item and replace `file_url` with the actual file content
    const dataWithFileContent = await Promise.all(
      data.map(async (item) => {
        // Extract the relative path from the file_url
        //maybe revert to const filePath = item.file_url.replace(process.env.StoragePath, ""); after testing
        const filePath = item.file_url.split("/").pop();

        const { data: fileData, error: fileError } = await supabase.storage
          .from("brk-files") // Name of your actual bucket
          .download(filePath); // Use the relative file path

        if (fileError) {
          console.error(
            `Failed to download file at ${item.file_url}:`,
            fileError
          );
          throw new Error(`Failed to download file at ${item.file_url}`);
        }

        // Convert file data to text or another format as needed
        const fileContent = await fileData.text();
        return {
          ...item,
          file_url: fileContent, // Replace `file_url` with the content of the file
        };
      })
    );

    res.json(dataWithFileContent);
  } catch (fetchError) {
    console.error(fetchError);
    res.status(500).send("Error fetching file contents");
  }
});

indexrouter.get("/readscript", async (req, res) => {
  const { title, index = 0 } = req.query;
  const pageSize = 18;
  const offset = index * pageSize;

  let query = supabase.from("script_files").select("*").eq("verified", true); // Add the `verified` condition here

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
    // Fetch the file content for each item and replace `file_url` with the actual file content
    const dataWithFileContent = await Promise.all(
      data.map(async (item) => {
        // Extract the relative path from the file_url
        //maybe revert to const filePath = item.file_url.replace(process.env.StoragePath, ""); after testing
        const filePath = item.file_url.split("/").pop();

        const { data: fileData, error: fileError } = await supabase.storage
          .from("brk-files") // Name of your actual bucket
          .download(filePath); // Use the relative file path

        if (fileError) {
          console.error(
            `Failed to download file at ${item.file_url}:`,
            fileError
          );
          throw new Error(`Failed to download file at ${item.file_url}`);
        }

        // Convert file data to text or another format as needed
        const fileContent = await fileData.text();
        return {
          ...item,
          file_url: fileContent, // Replace `file_url` with the content of the file
        };
      })
    );

    res.json(dataWithFileContent);
  } catch (fetchError) {
    console.error(fetchError);
    res.status(500).send("Error fetching file contents");
  }
});

module.exports = indexrouter;