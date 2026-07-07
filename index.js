const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder 
} = require('discord.js');
const http = require('http');

// 1. Render için Kesintisiz 7/24 Aktif Tutma Sunucusu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('San Diego Border RP Botu 7/24 Aktif!');
}).listen(3000, () => {
    console.log("Render Portu Aktif: 3000");
});

// 2. Bot İstemci Yapılandırması
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID;

// 3. Çoklu Gelişmiş Slash Komutları Tanımlamaları
const commands = [
    new SlashCommandBuilder()
        .setName('sunucu-kur')
        .setDescription('San Diego Border RP tüm sistemlerini, kanallarını ve rollerini sıfırdan kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('sınır-durumu')
        .setDescription('Sınır kapısının giriş durumunu günceller ve duyurur.')
        .addStringOption(option =>
            option.setName('durum')
                .setDescription('Sınırın yeni durumu ne olsun?')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 AÇIK (Pasaport Kontrolü Var)', value: 'açık' },
                    { name: '🔴 KAPALI (Girişler Durduruldu)', value: 'kapalı' },
                    { name: '🚨 KIRMIZI ALARM (Sınır İhlali Var)', value: 'alarm' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('sicil-ekle')
        .setDescription('Sınır ihlali yapan veya suç işleyen bir sivilin siciline işler.')
        .addUserOption(option => option.setName('kullanıcı').setDescription('Suçlu vatandaş').setRequired(true))
        .addStringOption(option => option.setName('suç').setDescription('İşlenen suç veya ihlal nedeni').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
].map(command => command.toJSON());

// 4. Bot Hazır Olduğunda Komutları API'ye Gönderme
client.once('ready', async () => {
    console.log(`[BAŞARILI] ${client.user.tag} olarak Discord bağlantısı sağlandı.`);
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('[SİSTEM] Slash komutları Discord API\'ye kaydediliyor...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('[SİSTEM] Tüm slash komutları başarıyla aktif edildi.');
    } catch (error) {
        console.error('[HATA] Komutlar yüklenirken bir problem oluştu:', error);
    }
});

// 5. Komutların ve Etkileşimlerin Yönetimi
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guild = interaction.guild;

    // --- SUNUCU KURMA SİSTEMİ ---
    if (interaction.commandName === 'sunucu-kur') {
        await interaction.reply({ content: '⏳ **San Diego Sınır RP** altyapısı kuruluyor... Lütfen bekleyin.', ephemeral: true });

        try {
            const rollerListesi = [
                { name: '👑 Sunucu Kurucusu', color: '#ff0000', hoist: true },
                { name: '🛡️ Yönetim Kadrosu', color: '#e74c3c', hoist: true },
                { name: '🎖️ RP Denetçisi / Admin', color: '#f1c40f', hoist: true },
                { name: '👮 Sınır Güvenliği Komutanı', color: '#1abc9c', hoist: true },
                { name: '🛡️ Sınır Güvenlik Ofisleri (Border Patrol)', color: '#2ecc71', hoist: true },
                { name: '🚓 Şerif Departmanı (SD)', color: '#3498db', hoist: true },
                { name: '🦅 Özel Kuvvetler (SWAT)', color: '#2c3e50', hoist: true },
                { name: '🚗 Sivil / Vatandaş', color: '#95a5a6', hoist: true },
                { name: '🛂 Turist / Ziyaretçi', color: '#bdc3c7', hoist: false }
            ];

            for (const r of rollerListesi) {
                await guild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    reason: 'San Diego Otomatik Altyapı Kurulumu'
                });
            }

            const katBilgi = await guild.channels.create({ name: '📢 BİLGİLENDİRME', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '📜-rp-kuralları', type: ChannelType.GuildText, parent: katBilgi.id });
            await guild.channels.create({ name: '📢-duyurular', type: ChannelType.GuildText, parent: katBilgi.id });
            await guild.channels.create({ name: '🎁-etkinlikler', type: ChannelType.GuildText, parent: katBilgi.id });

            const katSivil = await guild.channels.create({ name: '💬 SAN DIEGO RESORT', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '💬-genel-sohbet', type: ChannelType.GuildText, parent: katSivil.id });
            await guild.channels.create({ name: '📷-oyun-içi-medya', type: ChannelType.GuildText, parent: katSivil.id });
            await guild.channels.create({ name: '🤖-bot-komut', type: ChannelType.GuildText, parent: katSivil.id });

            const katBasvuru = await guild.channels.create({ name: '📝 BAŞVURU MERKEZİ', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '👮-memur-başvuruları', type: ChannelType.GuildText, parent: katBasvuru.id });
            await guild.channels.create({ name: '📁-başvuru-sonuçları', type: ChannelType.GuildText, parent: katBasvuru.id });

            const katIC = await guild.channels.create({ name: '🚔 SAN DIEGO BORDER (IC)', type: ChannelType.GuildCategory });
            const chSinir = await guild.channels.create({ name: '📰-sınır-durumu', type: ChannelType.GuildText, parent: katIC.id });
            await guild.channels.create({ name: '📄-sicil-kayıtları', type: ChannelType.GuildText, parent: katIC.id });
            await guild.channels.create({ name: '📻-telsiz-koordinasyon', type: ChannelType.GuildText, parent: katIC.id });

            const katSes = await guild.channels.create({ name: '🔊 SES ODALARI', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '🔊 Genel Sohbet', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: '🚓 Devriye Telsizi #1', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: '🦅 SWAT Operasyon', type: ChannelType.GuildVoice, parent: katSes.id });

            const hosgeldinEmbed = new EmbedBuilder()
                .setTitle('🇺🇸 San Diego Sınır Rol Yapma Sunucusuna Hoş Geldiniz!')
                .setDescription('Botumuz tarafından tüm kanallar, kategoriler ve yetki hiyerarşileri hatasız bir şekilde kurulmuştur. Sınır kapısı şu an aktif durumdadır!')
                .setColor('#2ecc71')
                .setTimestamp()
                .setFooter({ text: 'San Diego Gelişmiş Sınır Yönetim Sistemi' });

            await chSinir.send({ embeds: [hosgeldinEmbed] });
            await interaction.followUp({ content: '✅ **Başarılı!** Tüm kategoriler, kanallar ve özel roller başarıyla inşa edildi.', ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: '❌ Kurulum esnasında bir hata meydana geldi.', ephemeral: true });
        }
    }

    // --- SINIR DURUMU DEĞİŞTİRME SİSTEMİ ---
    if (interaction.commandName === 'sınır-durumu') {
        const durum = interaction.options.getString('durum');
        const sinirKanali = guild.channels.cache.find(c => c.name === '📰-sınır-durumu');

        if (!sinirKanali) {
            return interaction.reply({ content: '❌ `📰-sınır-durumu` kanalı bulunamadı. Lütfen önce `/sunucu-kur` yapın.', ephemeral: true });
        }

        let embed = new EmbedBuilder().setTimestamp();

        if (durum === 'açık') {
            embed.setTitle('🟢 SINIR KAPISI AÇIK')
                .setDescription('San Diego Sınır Kapısı an itibariyle geçişlere açılmıştır. Pasaport kontrol noktalarında sıraya giriniz. Kurallara uymayanlar gözaltına alınacaktır.')
                .setColor('#2ecc71');
        } else if (durum === 'kapalı') {
            embed.setTitle('🔴 SINIR KAPISI KAPATILDI')
                .setDescription('Görülen lüzum üzerine sınır kapısı geçici olarak sivil giriş çıkışlarına kapatılmıştır. Sınıra yaklaşanlar suçlu sayılacaktır!')
                .setColor('#e74c3c');
        } else if (durum === 'alarm') {
            embed.setTitle('🚨 KIRMIZI ALARM: SINIR İHLALİ')
                .setDescription('Sınır hattında kaçak geçiş teşebbüsü tespit edilmiştir! Tüm Sınır Güvenlik, Şerif ve SWAT ekiplerinin acilen konuşlanması gerekmektedir!')
                .setColor('#9b59b6');
        }

        await sinirKanali.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Sınır durumu başarıyla **${durum.toUpperCase()}** olarak güncellendi ve duyuruldu.`, ephemeral: true });
    }

    // --- SİCİL KAYDI SİSTEMİ ---
    if (interaction.commandName === 'sicil-ekle') {
        const hedefKullanici = interaction.options.getUser('kullanıcı');
        const sucDetayi = interaction.options.getString('suç');
        const sicilKanali = guild.channels.cache.find(c => c.name === '📄-sicil-kayıtları');

        if (!sicilKanali) {
            return interaction.reply({ content: '❌ `📄-sicil-kayıtları` kanalı bulunamadı.', ephemeral: true });
        }

        const sicilEmbed = new EmbedBuilder()
            .setTitle('📄 YENİ SİCİL VE SUÇ KAYDI')
            .setColor('#f39c12')
            .addFields(
                { name: '👤 Suçlu Vatandaş:', value: `${hedefKullanici} (${hedefKullanici.tag})`, inline: true },
                { name: '👮 Cezayı Kesen Memur:', value: `${interaction.user}`, inline: true },
                { name: '📝 İşlenen Suç / İhlal:', value: `\`${sucDetayi}\`` }
            )
            .setTimestamp();

        await sicilKanali.send({ embeds: [sicilEmbed] });
        await interaction.reply({ content: `✅ ${hedefKullanici.tag} isimli kullanıcının sicil kaydı başarıyla işlendi.`, ephemeral: true });
    }
});

// 6. Bot Giriş İşlemi
client.login(TOKEN);
