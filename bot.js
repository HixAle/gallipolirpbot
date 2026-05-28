const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ─── CONFIG ────────────────────────────────────────────────────────────────
const STAFF_CHANNEL_ID = '1509571947904635123';
const TOKEN = 'MTM5Mjg4NTQ1MzcxOTQ3MDEwMQ.Gqdkib.rSwcLr4340dAh88FrxDGejueLfq9aVVlPY0l6o';

// ─── DOMANDE CANDIDATURA ───────────────────────────────────────────────────
const DOMANDE = [
  // INFORMAZIONI PERSONALI
  { id: 'eta',               label: 'Quanti anni hai?',                       placeholder: 'Es: 17',                                    style: TextInputStyle.Short,     maxLength: 3   },
  { id: 'nome_ic',           label: 'Nome e Cognome IC',                      placeholder: 'Es: Marco Rossi',                           style: TextInputStyle.Short,     maxLength: 60  },
  { id: 'esperienza',        label: 'Da quanto giochi a GDR / Roleplay?',    placeholder: 'Es: 2 anni FiveM, 1 anno GTA RP',           style: TextInputStyle.Paragraph, maxLength: 300 },

  // DOMANDE RP
  { id: 'rp_cosa',           label: '[RP] Cos\'è il Roleplay?',               placeholder: 'Spiega come si differenzia dal gaming normale...', style: TextInputStyle.Paragraph, maxLength: 500 },
  { id: 'rp_metagame',       label: '[RP] Cos\'è il Metagaming?',             placeholder: 'Definizione + esempio concreto...',         style: TextInputStyle.Paragraph, maxLength: 400 },
  { id: 'rp_powergame',      label: '[RP] Cos\'è il Powergaming?',            placeholder: 'Definizione + esempio concreto...',         style: TextInputStyle.Paragraph, maxLength: 400 },
  { id: 'rp_scenario',       label: '[RP] Incidente stradale: come agisci?',  placeholder: 'Descrivi le tue azioni IC passo per passo...', style: TextInputStyle.Paragraph, maxLength: 600 },
  { id: 'rp_conflitto',      label: '[RP] Gestione conflitti con giocatori',  placeholder: 'Es: mediazione, admin report, ecc.',        style: TextInputStyle.Paragraph, maxLength: 400 },

  // DOMANDE OOC
  { id: 'ooc_regolamento',   label: '[OOC] Riassumi 2 regole del server',     placeholder: 'Regola 1: ... Regola 2: ...',               style: TextInputStyle.Paragraph, maxLength: 400 },
  { id: 'ooc_motivazione',   label: '[OOC] Perché vuoi entrare nello staff?', placeholder: 'Sii sincero e dettagliato...',              style: TextInputStyle.Paragraph, maxLength: 600 },
  { id: 'ooc_disponibilita', label: '[OOC] Ore settimanali disponibili',      placeholder: 'Es: ~10 ore, weekend e sere',              style: TextInputStyle.Short,     maxLength: 100 },
];

function chunkDomande(domande, size = 5) {
  const chunks = [];
  for (let i = 0; i < domande.length; i += size) chunks.push(domande.slice(i, i + size));
  return chunks;
}
const DOMANDE_CHUNKS = chunkDomande(DOMANDE, 5);

// Stato temporaneo candidature in corso
const candidatureInCorso = new Map(); // userId -> { step, risposte }

// ─── READY ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
});

// ─── COMANDO !candidatura ──────────────────────────────────────────────────
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (msg.content.toLowerCase() !== '!candidatura') return;

  const embed = new EmbedBuilder()
    .setTitle('📋 Candidatura Staff — GallipoliRP')
    .setDescription(
      '> Benvenuto nel processo di candidatura per **GallipoliRP** *(Emergency Hamburg)*.\n\n' +
      '**Requisiti necessari:**\n' +
      '• Aver compiuto almeno **14 anni**\n' +
      '• Conoscere il regolamento e i principi del roleplay\n' +
      '• Dimostrare **maturità, serietà** e senso di responsabilità\n' +
      '• Buona padronanza della **lingua italiana** scritta\n' +
      '• Disporre di un **microfono funzionante**\n' +
      '• Aver giocato sul server per almeno **3 giorni**\n\n' +
      '> Cliccando su **Inizia Candidatura** riceverai una serie di domande divise in più sezioni.\n> Rispondi con cura — lo staff valuterà ogni risposta.'
    )
    .setColor(0x1a1a2e)
    .setThumbnail('https://imgur.com/2yu0idt')
    .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_candidatura')
      .setLabel('✍️ Inizia Candidatura')
      .setStyle(ButtonStyle.Primary)
  );

  await msg.channel.send({ embeds: [embed], components: [row] });
});

// ─── INTERACTIONS ──────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── BUTTON: start candidatura ──
  if (interaction.isButton() && interaction.customId === 'start_candidatura') {
    const userId = interaction.user.id;

    if (candidatureInCorso.has(userId)) {
      return interaction.reply({
        content: '⚠️ Hai già una candidatura in corso! Completa i modal che ti sono stati inviati.',
        ephemeral: true,
      });
    }

    candidatureInCorso.set(userId, { step: 0, risposte: {} });
    await mostraModal(interaction, userId, 0);
    return;
  }

  // ── MODAL SUBMIT ──
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_candidatura_')) {
    const userId  = interaction.user.id;
    const step    = parseInt(interaction.customId.split('_').pop(), 10);
    const stato   = candidatureInCorso.get(userId);

    if (!stato) {
      return interaction.reply({
        content: '❌ Sessione scaduta. Ridigita `!candidatura` per ricominciare.',
        ephemeral: true,
      });
    }

    // Salva risposte del chunk corrente
    const chunk = DOMANDE_CHUNKS[step];
    for (const d of chunk) {
      stato.risposte[d.id] = interaction.fields.getTextInputValue(d.id);
    }

    const prossimo = step + 1;
    if (prossimo < DOMANDE_CHUNKS.length) {
      stato.step = prossimo;
      // ModalSubmitInteraction non supporta showModal direttamente:
      // rispondiamo con un bottone che triggera il prossimo modal
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`continua_candidatura__${prossimo}`)
          .setLabel(`Continua → Sezione ${prossimo + 1}/${DOMANDE_CHUNKS.length}`)
          .setStyle(ButtonStyle.Primary)
      );
      await interaction.reply({
        content: `✅ **Sezione ${step + 1}/${DOMANDE_CHUNKS.length} salvata!** Clicca il bottone per proseguire.`,
        components: [row],
        ephemeral: true,
      });
    } else {
      candidatureInCorso.delete(userId);
      await inviaAlloStaff(interaction, userId, stato.risposte);
    }
    return;
  }

  // ── BUTTON: continua candidatura (step 1+) ──
  if (interaction.isButton() && interaction.customId.startsWith('continua_candidatura__')) {
    const userId = interaction.user.id;
    const step   = parseInt(interaction.customId.split('__')[1], 10);
    const stato  = candidatureInCorso.get(userId);

    if (!stato) {
      return interaction.reply({
        content: '❌ Sessione scaduta. Ridigita `!candidatura` per ricominciare.',
        ephemeral: true,
      });
    }

    await mostraModal(interaction, userId, step);
    return;
  }

  // ── BUTTON STAFF: accetta_provino / approva / rifiuta ──
  if (interaction.isButton()) {
    const separatore = interaction.customId.indexOf('__');
    if (separatore === -1) return;

    const azione = interaction.customId.slice(0, separatore);
    const userId = interaction.customId.slice(separatore + 2);

    if (!['accetta_provino', 'approva', 'rifiuta'].includes(azione)) return;

    // FIX: defer update subito per evitare timeout Discord (>3s)
    await interaction.deferUpdate();

    const member  = await interaction.guild.members.fetch(userId).catch(() => null);
    const staffer = interaction.user;

    if (azione === 'accetta_provino') {
      const nuovaRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approva__${userId}`)
          .setLabel('✅ Approva')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`rifiuta__${userId}`)
          .setLabel('❌ Rifiuta')
          .setStyle(ButtonStyle.Danger),
      );

      const embedAggiornato = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xf0a500)
        .setFooter({ text: `Provino accettato da ${staffer.tag} • In attesa di esito` });

      await interaction.editReply({ embeds: [embedAggiornato], components: [nuovaRow] });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('📅 Provino Fissato — GallipoliRP')
          .setDescription(
            `Ciao **${member?.user.username ?? 'Candidato'}**!\n\n` +
            `Lo staffer **${staffer.tag}** ha accettato la tua candidatura e fisserà un **provino vocale** con te.\n\n` +
            `> Tieniti disponibile sui canali vocali del server.\n` +
            `> Verrai contattato a breve per definire data e ora del provino.\n\n` +
            `**Buona fortuna! 🍀**`
          )
          .setColor(0xf0a500)
          .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
          .setTimestamp();

        await member?.user.send({ embeds: [dmEmbed] });
      } catch { /* DM bloccati */ }

      return;
    }

    if (azione === 'approva') {
      const embedFine = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x2ecc71)
        .setFooter({ text: `✅ APPROVATO da ${staffer.tag}` });

      await interaction.editReply({ embeds: [embedFine], components: [] });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎉 Candidatura Approvata — GallipoliRP')
          .setDescription(
            `Congratulazioni **${member?.user.username ?? 'Candidato'}**!\n\n` +
            `La tua candidatura è stata **approvata** dallo staff di **GallipoliRP**!\n\n` +
            `> Verrai aggiunto al team a breve. Benvenuto a bordo! 🚔\n\n` +
            `_Per qualsiasi info contatta lo staff sul server._`
          )
          .setColor(0x2ecc71)
          .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
          .setTimestamp();

        await member?.user.send({ embeds: [dmEmbed] });
      } catch { /* DM bloccati */ }

      return;
    }

    if (azione === 'rifiuta') {
      const embedFine = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xe74c3c)
        .setFooter({ text: `❌ RIFIUTATO da ${staffer.tag}` });

      await interaction.editReply({ embeds: [embedFine], components: [] });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('📋 Esito Candidatura — GallipoliRP')
          .setDescription(
            `Ciao **${member?.user.username ?? 'Candidato'}**,\n\n` +
            `Purtroppo la tua candidatura non è stata **accettata** questa volta.\n\n` +
            `> Non scoraggiarti! Puoi riprovare in futuro dopo aver migliorato la tua esperienza sul server.\n\n` +
            `_Per capire su cosa lavorare, puoi aprire un ticket con lo staff._`
          )
          .setColor(0xe74c3c)
          .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
          .setTimestamp();

        await member?.user.send({ embeds: [dmEmbed] });
      } catch { /* DM bloccati */ }

      return;
    }
  }
});

// ─── FUNZIONI HELPER ───────────────────────────────────────────────────────

async function mostraModal(interaction, userId, step) {
  const chunk  = DOMANDE_CHUNKS[step];
  const totale = DOMANDE_CHUNKS.length;

  const modal = new ModalBuilder()
    .setCustomId(`modal_candidatura_${step}`)
    .setTitle(`Candidatura — Sezione ${step + 1}/${totale}`);

  for (const d of chunk) {
    const input = new TextInputBuilder()
      .setCustomId(d.id)
      .setLabel(d.label)
      .setPlaceholder(d.placeholder)
      .setStyle(d.style)
      .setRequired(true)
      .setMaxLength(d.maxLength);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  await interaction.showModal(modal);
}

async function inviaAlloStaff(interaction, userId, risposte) {
  const user = await client.users.fetch(userId);

  const desc = [
    `**👤 Candidato:** ${user.tag} (<@${userId}>)\n`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '**📌 INFORMAZIONI PERSONALI**',
    `> **Età:** ${risposte.eta}`,
    `> **Nome IC:** ${risposte.nome_ic}`,
    `> **Esperienza RP:** ${risposte.esperienza}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '**🎮 DOMANDE ROLEPLAY**',
    '',
    `**Cos'è il Roleplay?**\n${risposte.rp_cosa}`,
    '',
    `**Metagaming:**\n${risposte.rp_metagame}`,
    '',
    `**Powergaming:**\n${risposte.rp_powergame}`,
    '',
    `**Scenario incidente stradale:**\n${risposte.rp_scenario}`,
    '',
    `**Gestione conflitti RP:**\n${risposte.rp_conflitto}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '**🗣️ DOMANDE OOC**',
    '',
    `**Regolamento:**\n${risposte.ooc_regolamento}`,
    '',
    `**Motivazione:**\n${risposte.ooc_motivazione}`,
    '',
    `**Disponibilità:** ${risposte.ooc_disponibilita}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const MAX = 4000;
  const embedPrincipale = new EmbedBuilder()
    .setTitle('📥 Nuova Candidatura Staff')
    .setDescription(desc.length > MAX ? desc.slice(0, MAX - 20) + '\n*[testo troncato]*' : desc)
    .setColor(0x1a1a2e)
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accetta_provino__${userId}`)
      .setLabel('📅 Accetta Provino')
      .setStyle(ButtonStyle.Primary),
  );

  const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);
  await staffChannel.send({ embeds: [embedPrincipale], components: [row] });

  // Conferma DM al candidato
  try {
    const dmConferma = new EmbedBuilder()
      .setTitle('✅ Candidatura Inviata — GallipoliRP')
      .setDescription(
        `Ciao **${user.username}**!\n\n` +
        `La tua candidatura è stata **inviata con successo** allo staff di GallipoliRP.\n\n` +
        `> Lo staff la esaminerà il prima possibile.\n> Riceverai un messaggio privato con l'esito.\n\n` +
        `**Grazie per esserti candidato! 🙏**`
      )
      .setColor(0x1a1a2e)
      .setFooter({ text: 'GallipoliRP • Emergency Hamburg' })
      .setTimestamp();

    await user.send({ embeds: [dmConferma] });
  } catch { /* DM bloccati */ }

  await interaction.reply({
    content: '✅ Candidatura inviata allo staff! Riceverai aggiornamenti in DM.',
    ephemeral: true,
  });
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN non impostato. Avvia il bot con: DISCORD_TOKEN=il_tuo_token node bot.js');
  process.exit(1);
}

client.login(TOKEN);