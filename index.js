const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const http = require('http');

// 1. Render 7/24 Kesintisiz Aktif Tutma Sunucusu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('San Diego Gelişmiş RP Botu Aktif!');
}).listen(3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID;

// --- BASİT ANLIK VERİTABANI (RAM BELLEK) ---
// Bot her restart yediğinde sıfırlanmaması için ileride MongoDB/Quick.db entegre edilebilir.
const db = {
    users: {}, // { userId: { verified: false, cash: 1000, bank: 5000, idNo: "", passport: false, license: false, warns: 0, wanted: false, record: [] } }
    shifts: {}, // { userId: startTime }
    patrols: {} // { userId: startTime }
};

// Kullanıcı veritabanı başlatıcı fonksiyonu
function checkUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            verified: false,
            cash: 1000,
            bank: 5000,
            idNo: Math.floor(100000 + Math.random() * 900000).toString(),
            passport: "Mevcut Değil",
            license: "Mevcut Değil",
            warns: 0,
            wanted: false,
            record: []
        };
    }
    return db.users[userId];
}

// --- LOG FONKSİYONU ---
async function logToChannel(guild, channelName, embed) {
    const logChannel = guild.channels.cache.find(c => c.name === channelName || c.name.includes(channelName));
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// 2. TÜM SLASH KOMUTLARININ TANIMLANMASI
const commands = [
    new SlashCommandBuilder().setName('verify').setDescription('Sunucuya kayıt olmanızı ve sivil rolü almanızı sağlar.'),
    new SlashCommandBuilder().setName('id').setDescription('Kendi kimlik bilgilerinizi veya bir başkasının kimliğini görüntüler.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Kimliğine bakılacak kişi')),
    new SlashCommandBuilder().setName('passport').setDescription('Pasaport durumunuzu kontrol eder veya pasaport çıkartır/düzenler.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Yönetici için kullanıcı')).addStringOption(opt => opt.setName('durum').setDescription('Onaylı / İptal (Yetkili)').addChoices({name:'Onaylı', value:'Onaylı'}, {name:'İptal', value:'Mevcut Değil'})),
    new SlashCommandBuilder().setName('license').setDescription('Ehliyet ve araç ruhsat durumunu yönetir.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Kullanıcı')).addStringOption(opt => opt.setName('tür').setDescription('Ehliyet durumu').addChoices({name:'Var', value:'Mevcut'}, {name:'Yok', value:'Mevcut Değil'})),
    new SlashCommandBuilder().setName('fine').setDescription('Kuralları ihlal eden bir vatandaşa para cezası keser.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Ceza kesilecek kişi').setRequired(true)).addIntegerOption(opt => opt.setName('miktar').setDescription('Ceza miktarı').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Ceza sebebi').setRequired(true)),
    new SlashCommandBuilder().setName('arrest').setDescription('Suçlu bir sivili tutuklar ve hücreye atar.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Suçlu').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Suç nedeni').setRequired(true)),
    new SlashCommandBuilder().setName('release').setDescription('Hücredeki veya gözaltındaki bir sivili serbest bırakır.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Sivil').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Bir kullanıcıya uyarı (warn) ekler.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Uyarılacak kişi').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Uyarı nedeni').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Bir kullanıcıyı sunucudan atar.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Atılacak kişi').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Neden').setRequired(true)),
    new SlashCommandBuilder().setName('ban').setDescription('Bir kullanıcıyı sunucudan yasaklar.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Yasaklanacak kişi').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Neden').setRequired(true)),
    new SlashCommandBuilder().setName('wanted').setDescription('Bir sivil hakkında arama kararı (Aranıyor) çıkarır veya kaldırır.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Sivil').setRequired(true)).addBooleanOption(opt => opt.setName('durum').setDescription('True: Aranıyor / False: Temiz').setRequired(true)),
    new SlashCommandBuilder().setName('report').setDescription('Bir olay, ihlal veya durumu mahkeme/yönetim için kayıt altına alır.').addStringOption(opt => opt.setName('olay').setDescription('Olay detayları ve açıklaması').setRequired(true)),
    new SlashCommandBuilder().setName('ticket').setDescription('Destek, mülakat veya şikayet için bir talep odası açar.'),
    new SlashCommandBuilder().setName('shift').setDescription('LEO/Border Patrol memurları için mesai (vardiya) başlatır.'),
    new SlashCommandBuilder().setName('endshift').setDescription('Aktif vardiyanızı sonlandırır ve süreyi hesaplar.'),
    new SlashCommandBuilder().setName('patrol').setDescription('Ekipler için devriye (Patrol) sürecini başlatır.'),
    new SlashCommandBuilder().setName('endpatrol').setDescription('Devriye sürecini bitirir.'),
    new SlashCommandBuilder().setName('vehicle').setDescription('Üzerinize kayıtlı araç ruhsatı bilgilerini sorgular veya düzenler.').addUserOption(opt => opt.setName('kullanıcı').setDescription('Araç sahibi')).addStringOption(opt => opt.setName('model').setDescription('Araç modeli ve plakası'))
].map(command => command.toJSON());

// 3. BOT HAZIR OLDUĞUNDA KOMUTLARI KAYDETME
client.once('ready', async () => {
    console.log(`[BAŞARILI] ${client.user.tag} aktif!`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('[SİSTEM] Tüm gelişmiş RP komutları yüklendi.');
    } catch (e) { console.error(e); }
});

// 4. ETKİLEŞİM VE KOMUT YÖNETİMİ
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, user, member } = interaction;
    const targetUser = options.getUser('kullanıcı') || user;
    const userData = checkUser(targetUser.id);
    const authorData = checkUser(user.id);

    // --- VERIFY (KAYIT) SİSTEMİ ---
    if (commandName === 'verify') {
        const sivilRol = guild.roles.cache.find(r => r.name.includes('Sivil') || r.name.includes('Vatandaş'));
        userData.verified = true;
        if (sivilRol) await member.roles.add(sivilRol);

        const embed = new EmbedBuilder()
            .setTitle('🛂 San Diego Hudut Kapısı Kaydı')
            .setDescription(`Başarıyla doğrulandınız! Sivil kimliğiniz oluşturuldu.\n🆔 **Kimlik No:** \`${userData.idNo}\``)
            .setColor('#2ecc71');

        return interaction.reply({ embeds: [embed] });
    }

    // --- ID (KİMLİK) SİSTEMİ ---
    if (commandName === 'id') {
        const embed = new EmbedBuilder()
            .setTitle(`🪪 San Diego Eyalet Kimlik Kartı`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'Ad Soyad:', value: `${targetUser.username}`, inline: true },
                { name: 'Kimlik Seri No:', value: `\`${userData.idNo}\``, inline: true },
                { name: 'Aranma Durumu:', value: userData.wanted ? '🚨 ARANIYOR' : '🟢 Temiz', inline: true },
                { name: 'Nakit Para:', value: `$${userData.cash}`, inline: true },
                { name: 'Banka Hesabı:', value: `$${userData.bank}`, inline: true },
                { name: 'Aktif Uyarılar:', value: `⚠️ ${userData.warns}/3`, inline: true }
            )
            .setColor(userData.wanted ? '#e74c3c' : '#3498db');
        return interaction.reply({ embeds: [embed] });
    }

    // --- PASAPORT SİSTEMİ ---
    if (commandName === 'passport') {
        const durum = options.getString('durum');
        if (durum) {
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: '❌ Yetkiniz yetersiz.', ephemeral: true });
            userData.passport = durum;
            return interaction.reply({ content: `✅ ${targetUser.username} kişisinin pasaport durumu \`${durum}\` yapıldı.` });
        }
        return interaction.reply({ content: `🛂 **Pasaport Durumu (${targetUser.username}):** \`${userData.passport}\`` });
    }

    // --- EHLİYET & RUHSAT SİSTEMİ ---
    if (commandName === 'license') {
        const tur = options.getString('tür');
        if (tur) {
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: '❌ Yetkiniz yetersiz.', ephemeral: true });
            userData.license = tur;
            return interaction.reply({ content: `✅ Ehliyet durumu güncellendi.` });
        }
        return interaction.reply({ content: `🚗 **Sürüş Ehliyeti Durumu:** \`${userData.license}\`` });
    }

    // --- PARA CEZASI SİSTEMİ (/FINE) ---
    if (commandName === 'fine') {
        const miktar = options.getInteger('miktar');
        const sebep = options.getString('sebep');
        
        userData.bank -= miktar; // Cezayı bankadan keser
        userData.record.push(`[CEZA] Miktar: $${miktar} | Sebep: ${sebep} | Memur: ${user.username}`);

        const embed = new EmbedBuilder()
            .setTitle('🧾 Trafik / Asayiş Cezası Kesildi')
            .addFields(
                { name: 'Sürücü/Sivil:', value: `${targetUser}`, inline: true },
                { name: 'Cezayı Kesen:', value: `${user}`, inline: true },
                { name: 'Ceza Tutarı:', value: `$${miktar}`, inline: true },
                { name: 'Ceza Nedeni:', value: `\`${sebep}\`` }
            )
            .setColor('#e67e22')
            .setTimestamp();

        await logToChannel(guild, 'sicil-kayıtları', embed);
        return interaction.reply({ embeds: [embed] });
    }

    // --- TUTUKLAMA SİSTEMİ (/ARREST) ---
    if (commandName === 'arrest') {
        const sebep = options.getString('sebep');
        userData.record.push(`[TUTUKLAMA] Sebep: ${sebep} | Memur: ${user.username}`);
        
        const embed = new EmbedBuilder()
            .setTitle('🚨 Şüpheli Gözaltına Alındı / Tutuklandı')
            .setDescription(`${targetUser} suç işlediği gerekçesiyle emniyet güçleri tarafından hücreye sevk edilmiştir.`)
            .addFields(
                { name: 'Suçlu:', value: `${targetUser}`, inline: true },
                { name: 'Tutuklayan Memur:', value: `${user}`, inline: true },
                { name: 'Suç Nedeni:', value: `\`${sebep}\`` }
            )
            .setColor('#7f8c8d');

        await logToChannel(guild, 'sicil-kayıtları', embed);
        return interaction.reply({ embeds: [embed] });
    }

    // --- SERBEST BIRAKMA (/RELEASE) ---
    if (commandName === 'release') {
        const embed = new EmbedBuilder()
            .setTitle('🔓 Tahliye İşlemi Yapıldı')
            .setDescription(`${targetUser} hücresinden yasal olarak tahliye edilmiştir.`)
            .setAuthor({ name: `Sorumlu Memur: ${user.username}` })
            .setColor('#2ecc71');
        
        await logToChannel(guild, 'sicil-kayıtları', embed);
        return interaction.reply({ embeds: [embed] });
    }

    // --- UYARI SİSTEMİ (/WARN) ---
    if (commandName === 'warn') {
        const sebep = options.getString('sebep');
        userData.warns += 1;
        userData.record.push(`[UYARI] Nedeni: ${sebep}`);

        return interaction.reply({ content: `⚠️ ${targetUser} başarıyla uyarıldı. Güncel uyarı puanı: **${userData.warns}/3**\nSebep: ${sebep}` });
    }

    // --- ARANMA SİSTEMİ (/WANTED) ---
    if (commandName === 'wanted') {
        const durum = options.getBoolean('durum');
        userData.wanted = durum;

        const embed = new EmbedBuilder()
            .setTitle(durum ? '🚨 SEYALET ALARMI: ARANMA KARARI' : '🟢 ARANMA KARARI KALDIRILDI')
            .setDescription(durum ? `${targetUser} federal yasaları çiğnediği için **ARANANLAR** listesine alınmıştır! Görüldüğü yerde müdahale edilecektir.` : `${targetUser} üzerindeki tüm suçlamalar düşürülmüştür.`)
            .setColor(durum ? '#ff0000' : '#2ecc71');

        await logToChannel(guild, 'sınır-durumu', embed);
        return interaction.reply({ embeds: [embed] });
    }

    // --- VARDİYA SİSTEMİ (/SHIFT & /ENDSHIFT) ---
    if (commandName === 'shift') {
        db.shifts[user.id] = Date.now();
        return interaction.reply({ content: '🏃‍♂️ **Vardiyanız (Shift) Başladı.** Sınır kapısı veya devriye alanında göreve hazır durumdasınız! Kolay gelsin memur.' });
    }

    if (commandName === 'endshift') {
        const start = db.shifts[user.id];
        if (!start) return interaction.reply({ content: '❌ Aktif bir vardiyanız bulunmuyor.', ephemeral: true });
        
        const passed = Math.floor((Date.now() - start) / 1000 / 60); // dakika cinsinden
        delete db.shifts[user.id];

        const embed = new EmbedBuilder()
            .setTitle('📋 Vardiya Raporu (Shift End)')
            .addFields(
                { name: 'Memur:', value: `${user}`, inline: true },
                { name: 'Süre:', value: `\`${passed} Dakika\``, inline: true }
            )
            .setColor('#9b59b6');

        await logToChannel(guild, '📻-telsiz-koordinasyon', embed);
        return interaction.reply({ content: `🚨 Vardiyanız bitti. Toplam süre: **${passed} dakika**. Rapor telsiz odasına iletildi.` });
    }

    // --- DEVRİYE SİSTEMİ (/PATROL & /ENDPATROL) ---
    if (commandName === 'patrol') {
        db.patrols[user.id] = Date.now();
        return interaction.reply({ content: '🚓 **Devriye Başlatıldı!** San Diego sokakları ve sınır hattı koruma altında.' });
    }

    if (commandName === 'endpatrol') {
        const start = db.patrols[user.id];
        if (!start) return interaction.reply({ content: '❌ Başlatılmış bir devriyeniz yok.', ephemeral: true });
        const passed = Math.floor((Date.now() - start) / 1000 / 60);
        delete db.patrols[user.id];
        return interaction.reply({ content: `🚓 Devriye sona erdi. Hat boyunca **${passed} dakika** boyunca asayiş sağlandı.` });
    }

    // --- OLAY KAYDI / MAHKEME RAPORU (/REPORT) ---
    if (commandName === 'report') {
        const olay = options.getString('olay');
        const embed = new EmbedBuilder()
            .setTitle('⚖️ Yeni Olay Raporu / Mahkeme Dosyası')
            .setDescription(olay)
            .setAuthor({ name: `Raporu Sunan: ${user.username}` })
            .setTimestamp()
            .setColor('#34495e');

        await logToChannel(guild, '📄-sicil-kayıtları', embed);
        return interaction.reply({ content: '✅ Olay kaydı ve deliller mahkeme/sicil kayıtları havuzuna iletildi.', ephemeral: true });
    }

    // --- TICKET SİSTEMİ (/TICKET) ---
    if (commandName === 'ticket') {
        const ch = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const kapatButon = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket-kapat').setLabel('Talebi Kapat').setStyle(ButtonStyle.Danger)
        );

        await ch.send({ content: `Merhaba ${user}, Destek/Mülakat odanız açıldı. Yetkililer birazdan burada olacak.`, components: [kapatButon] });
        return interaction.reply({ content: `✅ Destek talebiniz açıldı: ${ch}`, ephemeral: true });
    }

    // --- KICK & BAN SİSTEMLERİ ---
    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '❌ Yetkiniz yok.', ephemeral: true });
        const sebep = options.getString('sebep');
        await guild.members.kick(targetUser.id, sebep);
        return interaction.reply({ content: `✅ ${targetUser.username} sunucudan atıldı. Nedeni: ${sebep}` });
    }

    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ Yetkiniz yok.', ephemeral: true });
        const sebep = options.getString('sebep');
        await guild.members.ban(targetUser.id, { reason: sebep });
        return interaction.reply({ content: `🚨 ${targetUser.username} kalıcı olarak banlandı. Nedeni: ${sebep}` });
    }

    // --- ARAÇ RUHSATI (/VEHICLE) ---
    if (commandName === 'vehicle') {
        const model = options.getString('model');
        if (model) {
            return interaction.reply({ content: `✅ ${targetUser.username} adına yeni araç ruhsatı tanımlandı: \`${model}\`` });
        }
        return interaction.reply({ content: `🚗 ${targetUser.username} kullanıcısının aktif araç ruhsat kaydı bulunamadı (Oyunda satın alıp memura işletmesi gerekir).` });
    }
});

// Button Etkileşimi (Ticket Kapatma için)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'ticket-kapat') {
        await interaction.reply('🔒 Oda 5 saniye içinde siliniyor...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
