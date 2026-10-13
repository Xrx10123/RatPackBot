import { Client, GatewayIntentBits, Partials } from 'discord.js';

export function createClient({ messageContent = false } = {}) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ];
  if (messageContent) intents.push(GatewayIntentBits.MessageContent);

  const client = new Client({ intents, partials: [Partials.Message, Partials.Reaction] });
  client.ratpack = { messageContent };
  return client;
}
