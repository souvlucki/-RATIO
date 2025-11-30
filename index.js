// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

const PREFIX = ',';

// In-memory warning storage (use a database for production)
const warnings = new Map(); // Structure: userId -> [{ moderator, reason, timestamp }]
const jailedUsers = new Map(); // Structure: userId -> [roleIds] (stores previous roles)

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is now online!`);
    console.log(`Bot ID: ${client.user.id}`);
    client.user.setActivity('for moderation commands', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'role':
                await handleRole(message, args);
                break;
            case 'mute':
                await handleMute(message, args);
                break;
            case 'unmute':
                await handleUnmute(message, args);
                break;
            case 'kick':
                await handleKick(message, args);
                break;
            case 'ban':
                await handleBan(message, args);
                break;
            case 'unban':
                await handleUnban(message, args);
                break;
            case 'jail':
                await handleJail(message, args);
                break;
            case 'unjail':
                await handleUnjail(message, args);
                break;
            case 'purge':
                await handlePurge(message, args);
                break;
            case 'warn':
                await handleWarn(message, args);
                break;
            case 'warnings':
            case 'warns':
                await handleWarnings(message, args);
                break;
            case 'clearwarns':
            case 'clearwarnings':
                await handleClearWarnings(message, args);
                break;
        }
    } catch (error) {
        console.error(`Error executing ${command}:`, error);
        message.reply(`❌ An error occurred: ${error.message}`);
    }
});

// Role command
async function handleRole(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You do not have permission to manage roles.');
    }

    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = message.guild.roles.cache.find(r => 
        r.name.toLowerCase() === roleName.toLowerCase() || 
        r.id === args[1]?.replace(/[<@&>]/g, '')
    );

    if (!member || !role) {
        return message.reply('❌ Please mention a member and provide a valid role.\nUsage: `,role @member @role`');
    }

    if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        message.reply(`✅ Removed ${role} from ${member.user.tag}`);
    } else {
        await member.roles.add(role);
        message.reply(`✅ Added ${role} to ${member.user.tag}`);
    }
}

// Mute command
async function handleMute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You do not have permission to timeout members.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to mute.\nUsage: `,mute @member [minutes] [reason]`');
    }

    const duration = parseInt(args[1]) || 60;
    const reason = args.slice(2).join(' ') || 'No reason provided';

    const durationMs = duration * 60 * 1000;
    await member.timeout(durationMs, reason);
    
    message.reply(`🔇 ${member.user.tag} has been muted for ${duration} minutes.\nReason: ${reason}`);
}

// Unmute command
async function handleUnmute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You do not have permission to timeout members.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to unmute.\nUsage: `,unmute @member`');
    }

    await member.timeout(null);
    message.reply(`🔊 ${member.user.tag} has been unmuted.`);
}

// Kick command
async function handleKick(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return message.reply('❌ You do not have permission to kick members.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to kick.\nUsage: `,kick @member [reason]`');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await member.kick(reason);
    message.reply(`👢 ${member.user.tag} has been kicked.\nReason: ${reason}`);
}

// Ban command
async function handleBan(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply('❌ You do not have permission to ban members.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to ban.\nUsage: `,ban @member [reason]`');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await member.ban({ reason, deleteMessageSeconds: 86400 });
    message.reply(`🔨 ${member.user.tag} has been banned.\nReason: ${reason}`);
}

// Unban command
async function handleUnban(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply('❌ You do not have permission to unban members.');
    }

    const userId = args[0];
    if (!userId) {
        return message.reply('❌ Please provide a user ID to unban.\nUsage: `,unban <user_id>`');
    }

    try {
        await message.guild.members.unban(userId);
        message.reply(`✅ User with ID ${userId} has been unbanned.`);
    } catch (error) {
        message.reply('❌ User not found or not banned.');
    }
}

// Jail command
async function handleJail(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You do not have permission to manage roles.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to jail.\nUsage: `,jail @member [reason]`');
    }

    const jailRole = message.guild.roles.cache.find(r => r.name === 'Jailed');
    if (!jailRole) {
        return message.reply('❌ No "Jailed" role found. Please create one first.');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    // Get all current roles except @everyone
    const memberRoles = member.roles.cache.filter(r => r.id !== message.guild.id);
    const roleIds = memberRoles.map(r => r.id);

    // Store the roles for later restoration
    jailedUsers.set(member.id, roleIds);

    try {
        // Remove all roles except @everyone
        await member.roles.remove(memberRoles, `Jailed: ${reason}`);

        // Add jail role
        await member.roles.add(jailRole, reason);
        
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🔒 Member Jailed')
            .setDescription(`${member.user.tag} has been jailed`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Moderator', value: message.author.tag },
                { name: 'Roles Removed', value: `${roleIds.length} role(s) saved for restoration` }
            )
            .setTimestamp();

        message.channel.send({ embeds: [embed] });

        // Try to DM the user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('🔒 You have been jailed')
                .setDescription(`You have been jailed in **${message.guild.name}**`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();

            await member.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log('Could not DM jailed user');
        }
    } catch (error) {
        console.error('Error jailing member:', error);
        message.reply(`❌ Failed to jail member: ${error.message}`);
    }
}

// Unjail command
async function handleUnjail(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You do not have permission to manage roles.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to unjail.\nUsage: `,unjail @member`');
    }

    const jailRole = message.guild.roles.cache.find(r => r.name === 'Jailed');
    if (!jailRole) {
        return message.reply('❌ No "Jailed" role found.');
    }

    // Check if user was jailed (has stored roles)
    const savedRoleIds = jailedUsers.get(member.id);

    try {
        // Remove jail role
        await member.roles.remove(jailRole);

        let restoredCount = 0;

        // Restore previous roles if they exist
        if (savedRoleIds && savedRoleIds.length > 0) {
            const rolesToRestore = savedRoleIds
                .map(roleId => message.guild.roles.cache.get(roleId))
                .filter(role => role !== undefined); // Filter out deleted roles

            if (rolesToRestore.length > 0) {
                await member.roles.add(rolesToRestore, 'Unjailed - roles restored');
                restoredCount = rolesToRestore.length;
            }

            // Clear the stored roles
            jailedUsers.delete(member.id);
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔓 Member Released from Jail')
            .setDescription(`${member.user.tag} has been released from jail`)
            .addFields(
                { name: 'Moderator', value: message.author.tag },
                { name: 'Roles Restored', value: restoredCount > 0 ? `${restoredCount} role(s)` : 'No roles to restore' }
            )
            .setTimestamp();

        message.channel.send({ embeds: [embed] });

        // Try to DM the user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🔓 You have been released from jail')
                .setDescription(`You have been released from jail in **${message.guild.name}**`)
                .setTimestamp();

            await member.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log('Could not DM unjailed user');
        }
    } catch (error) {
        console.error('Error unjailing member:', error);
        message.reply(`❌ Failed to unjail member: ${error.message}`);
    }
}

// Purge command
async function handlePurge(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply('❌ You do not have permission to manage messages.');
    }

    const amount = parseInt(args[0]);
    
    if (isNaN(amount) || amount < 1 || amount > 100) {
        return message.reply('❌ Please provide a number between 1 and 100.\nUsage: `,purge <amount>`');
    }

    try {
        // Delete the command message
        await message.delete();
        
        // Fetch and delete messages
        const messages = await message.channel.messages.fetch({ limit: amount });
        const deletedMessages = await message.channel.bulkDelete(messages, true);
        
        const reply = await message.channel.send(`🗑️ Successfully deleted ${deletedMessages.size} messages.`);
        
        // Auto-delete confirmation message after 5 seconds
        setTimeout(() => reply.delete().catch(err => console.error(err)), 5000);
    } catch (error) {
        console.error('Error purging messages:', error);
        message.channel.send('❌ Failed to purge messages. Messages older than 14 days cannot be bulk deleted.');
    }
}

// Warn command
async function handleWarn(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You do not have permission to warn members.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to warn.\nUsage: `,warn @member [reason]`');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    // Get or create warning array for this user
    if (!warnings.has(member.id)) {
        warnings.set(member.id, []);
    }

    const userWarnings = warnings.get(member.id);
    userWarnings.push({
        moderator: message.author.tag,
        moderatorId: message.author.id,
        reason: reason,
        timestamp: new Date().toISOString()
    });

    const warnCount = userWarnings.length;

    // Send warning embed
    const warnEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Member Warned')
        .setDescription(`${member.user.tag} has been warned`)
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: message.author.tag },
            { name: 'Total Warnings', value: `${warnCount}` }
        )
        .setTimestamp();

    await message.channel.send({ embeds: [warnEmbed] });

    // Try to DM the user
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ You have been warned')
            .setDescription(`You have been warned in **${message.guild.name}**`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Total Warnings', value: `${warnCount}` }
            )
            .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        message.channel.send('⚠️ Could not DM the user about their warning.');
    }
}

// Warnings command - View warnings for a user
async function handleWarnings(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You do not have permission to view warnings.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to view warnings.\nUsage: `,warnings @member`');
    }

    const userWarnings = warnings.get(member.id);

    if (!userWarnings || userWarnings.length === 0) {
        return message.reply(`✅ ${member.user.tag} has no warnings.`);
    }

    const warningList = userWarnings.map((warn, index) => {
        const date = new Date(warn.timestamp).toLocaleString();
        return `**${index + 1}.** ${warn.reason}\n• Moderator: ${warn.moderator}\n• Date: ${date}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`⚠️ Warnings for ${member.user.tag}`)
        .setDescription(warningList)
        .setFooter({ text: `Total Warnings: ${userWarnings.length}` })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// Clear warnings command
async function handleClearWarnings(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need Administrator permission to clear warnings.');
    }

    const member = message.mentions.members.first();
    if (!member) {
        return message.reply('❌ Please mention a member to clear warnings.\nUsage: `,clearwarns @member`');
    }

    const userWarnings = warnings.get(member.id);

    if (!userWarnings || userWarnings.length === 0) {
        return message.reply(`${member.user.tag} has no warnings to clear.`);
    }

    const warnCount = userWarnings.length;
    warnings.delete(member.id);

    message.reply(`✅ Cleared ${warnCount} warning(s) for ${member.user.tag}`);
}

// Login
client.login(process.env.DISCORD_TOKEN);