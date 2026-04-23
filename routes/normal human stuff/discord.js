const express = require("express"); // we use this because why not even tho it isnt used in this file
const { createClient } = require("@supabase/supabase-js");
const { Client, Intents } = require("discord.js");
const axios = require("axios");
//require("dotenv").config();
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
  ],
  partials: ["CHANNEL"],
});

const router2 = express.Router();
// Use service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key
const supabase = createClient(supabaseUrl, supabaseKey);

//discord bot

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const prefix = "!";
//731219953499504722
async function sendMessageToOwner(messageContent) {
  const ownerId = "731219953499504722"; // Replace this with your Discord user ID
  try {
    const user = await client.users.fetch(ownerId);
    await user.send(messageContent);
    console.log(`Message sent to owner: ${messageContent}`);
  } catch (error) {
    console.error("Failed to send DM:", error);
  }
}

async function sendUserData(message, args) {
  let userId = args[0];
  let query = `https://sandpile.xyz/api/getUserInfoById/${userId}`;
  if (isNaN(parseFloat(userId))){
      query = `https://sandpile.xyz/api/getIdByUsername/${userId}`;
  } 
  const response = await axios.get(
    query
  );
  const userData = response.data;

  if (!userData.username) {
    return message.reply(`User with ID ${userId} not found.`);
  }
  const createdDate = new Date(userData.created_at);
  const timestamp = Math.floor(createdDate.getTime() / 1000); // Convert to seconds
  const createdDate2 = new Date(userData.last_online);
  const timestamp2 = Math.floor(createdDate2.getTime() / 1000); // Convert to seconds
  const embed = {
    color: 0x2b2d31,
    title: userData.username,
    url: `https://sandpile.xyz/user/${userData.id}`, // Replace with actual profile URL
    thumbnail: { url: "https://sandpile.xyz/content/" + userData.avatar },
    fields: [
      { name: "Created at", value: `<t:${timestamp}:F>`, inline: false },
      { name: "Last Online", value: `<t:${timestamp2}:F>`, inline: false },
    ],
    description: userData.description,
  };
  if (userData.admin == true) {
    embed.fields.push({ name: "Admin", value: "true", inline: true });
  }

  message.reply({ embeds: [embed] });
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "ping") {
      message.reply("Pong!");
    }
    if (command === "verify" || command === "scriptverify") {
      const userId = message.author.id;

      // Check if the user has permission (e.g., specific user ID)
      if (userId === "731219953499504722") {
        // Replace with the actual ID

        // Ensure the user provides an ID as an argument
        const itemid = parseInt(args[0], 10);
        if (isNaN(itemid)) {
          return message.reply({
            content: "❌ Please provide a valid item ID.",
            ephemeral: true,
          });
        }
        var source = "brk_files";
        if (command === "scriptverify") {
          source = "script_files";
        }
        // Fetch the item from the 'brk_files' table by its ID
        const { data: item, error: fetchError } = await supabase
          .from(source)
          .select("*")
          .eq("id", itemid)
          .single();

        if (fetchError) {
          console.error(fetchError);
          return message.reply({
            content: "❌ Error fetching item from database.",
            ephemeral: true,
          });
        }

        // Check if the item exists
        if (!item) {
          return message.reply({
            content: `❌ No item found with ID: ${itemid}`,
            ephemeral: true,
          });
        }

        // Update the 'verified' field to true
        const { error: updateError } = await supabase
          .from(source)
          .update({ verified: true })
          .eq("id", itemid);

        if (updateError) {
          console.error(updateError);
          return message.reply({
            content: "❌ Error updating verification status.",
            ephemeral: true,
          });
        }

        // Fetch the channel to send the success message
        // revert 1304895353937592361 after testing
        const channel = await client.channels.fetch("1304895353937592361");
        if (channel) {
          var textrest = ` This is the ${itemid}th item`;
          if (
            itemid != 100 &&
            itemid != 150 &&
            itemid != 200 &&
            itemid != 250 &&
            itemid != 300 &&
            itemid != 400 &&
            itemid != 500 &&
            itemid != 750 &&
            itemid != 1000 &&
            itemid != 1001 &&
            itemid != 1500 &&
            itemid != 2000 &&
            itemid != 2500 &&
            itemid != 3000 &&
            itemid != 3500 &&
            itemid != 4000 &&
            itemid != 5000
          ) {
            textrest = "";
          }
          /*channel.send(
            `✅ ${item.username}'s ${item.title} has been successfully verified by moderator ${message.author.tag}!` +
              textrest
          );*/
        }

        // Send success reply to the user
        return message.reply({
          content: `✅ Item ${itemid} has been verified!`,
          ephemeral: false,
        });
      } else {
        return message.reply({
          content: "❌ You do not have permission to verify items.",
          ephemeral: true,
        });
      }
    }
    
      if (command === "scriptdelete" || command === "brkdelete") {
      const userId = message.author.id;
      if (userId !== "731219953499504722") {
        return message.reply({
          content: "❌ You do not have permission to delete items.",
          ephemeral: true,
        });
      }

      const itemid = parseInt(args[0], 10);
      if (isNaN(itemid)) {
        return message.reply({
          content: "❌ Please provide a valid item ID.",
          ephemeral: true,
        });
      }

      // Choose the appropriate table based on command
      let source = "brk_files";
      if (command === "scriptdelete") {
        source = "script_files";
      }

      // Fetch the item from the database
      const { data: item, error: fetchError } = await supabase
        .from(source)
        .select("*")
        .eq("id", itemid)
        .single();

      if (fetchError) {
        console.error(fetchError);
        return message.reply({
          content: "❌ Error fetching item from database.",
          ephemeral: true,
        });
      }

      if (!item) {
        return message.reply({
          content: `❌ No item found with ID: ${itemid}`,
          ephemeral: true,
        });
      }

      const fileUrl = item.file_url;
      if (!fileUrl) {
        return message.reply({
          content: "❌ File URL not specified for this item.",
          ephemeral: true,
        });
      }

      const urlParts = fileUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      const { error: removeError } = await supabase.storage
        .from("brk-files")
        .remove([fileName]);

      if (removeError) {
        console.error(removeError);
        return message.reply({
          content: "❌ Error deleting file from storage.",
          ephemeral: true,
        });
      }

      const { error: deleteError } = await supabase
        .from(source)
        .delete()
        .eq("id", itemid);

      if (deleteError) {
        console.error(deleteError);
        return message.reply({
          content: "❌ Error deleting item from database.",
          ephemeral: true,
        });
      }

      const channel = await client.channels.fetch("1304895353937592361");
      if (channel) {
        /*channel.send(
          `✅ Item ${itemid} (${item.title}) by ${item.username} has been deleted by moderator ${message.author.tag}.`
        );*/
      }

      return message.reply({
        content: `✅ Item ${itemid} has been successfully deleted.`,
        ephemeral: false,
      });
  }
    
    
    try{
			if (command === 'u') {
			  sendUserData(message,args);
      }
			if(command == 'onlinecount'){
				const response = await axios.get('https://sandpile.xyz/sets?query=&sort=');
					 // Convert the response data to a string
				const htmlContent = response.data;

				// Use a regular expression to find all numbers followed by "Playing"
				const regex = /(\d+)\s*Playing/g;
				const matches = [...htmlContent.matchAll(regex)];

				// Sum up all the found numbers
				const totalPlayers = matches.reduce((sum, match) => sum + parseInt(match[1], 10), 0);

			  message.reply('There are `'+totalPlayers+'` players that are playing games in SandPile')
			}
			if (command == 'lastuser'){
			  const response = await axios.get('https://sandpile.xyz/users?query=&sort=did');

				// Convert the response data to a string
				const htmlContent = response.data;

				// Use a regular expression to find the first match for '/user/<id>'
				const regex = /\/user\/(\d+)/;
				const match = htmlContent.match(regex);

				if (match && match[0]) {
				  sendUserData(message,[match[0].split('user/')[1]]);
				} else {
					console.log("No user link found.");
				}
			}
	  }catch{}
  }

  
});

client.login(process.env.DISCORD_TOKEN);

module.exports = {
  router2,
  client,
  sendUserData,
  sendMessageToOwner
};