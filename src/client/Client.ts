import consola, { Consola } from 'consola';
import { Client, Intents, Collection, Channel, VoiceChannel } from 'discord.js';
import { Config } from '../interfaces/Config';
import { Command } from '../interfaces/Command';
import { Event } from '../interfaces/Event';
import { Button } from '../interfaces/Button';
import { QueryQueue } from '../components/models/QueryQueue';
import { EmbedPage } from '../components/models/EmbedPage';
import { EmbedPageInterface } from '../interfaces/EmbedPage';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import child_process from 'child_process';

class Bot extends Client {
    public logger: Consola = consola;
    public commands: Collection<string, Command> = new Collection();
    public events: Collection<string, Event> = new Collection();
    public buttons: Collection<string, Button> = new Collection();
    public embeds: Collection<string, EmbedPage> = new Collection();
    public config!: Config;
    public queryQueue: QueryQueue = new QueryQueue();

    public constructor() {
        super({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_VOICE_STATES,
                Intents.FLAGS.GUILD_WEBHOOKS,
            ],
        });
    }

    public async start(config: Config): Promise<void> {
        this.config = config;
        await this.loadCommands();
        await this.loadEvents();
        await this.loadButtons();
        super.login(config.token);
    }

    private async loadCommands() {
        this.logger.info(`Loading commands...`);

        const commandFiles: string[] = fs
            .readdirSync(path.resolve(__dirname, '../commands'))
            .filter((file) => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command: Command = require(`../commands/${file}`);
            this.commands.set(command.data.name, command);
            this.logger.success(`Command ${command.data.name} loaded.`);
        }

        this.logger.success(`Commands loaded.`);
    }

    private async loadEvents() {
        this.logger.info(`Loading events...`);

        const eventFiles = fs
            .readdirSync(path.resolve(__dirname, '../events'))
            .filter((file) => file.endsWith('.js'));

        for (const file of eventFiles) {
            const event = require(`../events/${file}`);
            if (event.once) {
                this.once(event.name, (...args) => event.execute(...args));
            } else {
                this.on(event.name, (...args) => event.execute(...args));
            }
            this.logger.success(`Listening to ${event.name} event.`);
        }

        this.logger.success(`Events loaded.`);
    }

    private async loadButtons() {
        this.logger.info(`Loading buttons...`);

        const buttonFiles: string[] = fs
            .readdirSync(path.resolve(__dirname, '../components/buttons'))
            .filter((file) => file.endsWith('.js'));

        for (const file of buttonFiles) {
            const button: Button = require(`../components/buttons/${file}`);
            this.buttons.set(button.data.customId!, button);
            this.logger.success(`Button ${button.data.customId} loaded.`);
        }

        this.logger.success(`Buttons loaded.`);
    }

    public async loadEmbeds() {
        this.logger.info(`Loading embeds...`);

        const embedFiles: string[] = fs
            .readdirSync(path.resolve(__dirname, '../components/embed_pages'))
            .filter((file) => file.endsWith('.js'));

        for (const file of embedFiles) {
            const embed: EmbedPageInterface = require(`../components/embed_pages/${file}`);
            this.embeds.set(embed.data.name, embed.data);
            if (
                embed.data.name === 'students' ||
                embed.data.name === 'teachers'
            ) {
                this.queryQueue.addObserver(embed.data);
            }
            if (embed.data.autoSend) {
                await embed.data.send();
                this.logger.success(`Embed ${embed.data.name} sent.`);
            }
        }

        this.logger.success(`Sent ${this.embeds.size} embeds.`);
    }

    public async removeUnusedClonedChannels() {
        const unusedClonedChannels = await this.filterUnusedClonedChannels();

        this.logger.info(
            `Removing ${unusedClonedChannels.size} unused channels...`
        );

        unusedClonedChannels.forEach(async (channel) => {
            await channel.delete().catch((err) => this.logger.error(err));
        });

        this.logger.success(`Unused channels removed.`);
    }

    private async filterUnusedClonedChannels(): Promise<
        Collection<string, Channel>
    > {
        this.logger.info(`Filtering unused channels...`);

        const unusedClonedChannels = this.channels.cache.filter(
            (channel) =>
                channel.isVoice() &&
                (channel as VoiceChannel).members.size === 0 &&
                this.isMitosisCategory(channel) &&
                this.isNotDonor(channel)
        );

        this.logger.success(`Unused channels filtered.`);

        return unusedClonedChannels;
    }

    private isNotDonor(channel: Channel): boolean {
        return channel.id !== this.config.mitosisVoiceChannelID;
    }

    private isMitosisCategory(channel: Channel) {
        return (
            (channel as VoiceChannel).parent!.id ==
            this.config.mitosisCategoryID
        );
    }

    public scheduleMessages() {
        this.logger.info(`Scheduling messages...`);

        cron.schedule(
            '0 50 18 * 9,10,11,12 1,4',
            () => {
                this.logger.info('Sending class reminder...');
                this.embeds.get('nextClass')!.send();
                this.logger.success('Class remainder sent.');
            },
            { timezone: 'America/Argentina/Buenos_Aires' }
        );

        cron.schedule(
            '0 10 22 * 9,10,11,12 1,4',
            async () => {
                this.logger.info('Loading next class event data...');
                await this.updateNextClassData();
                this.logger.success('Next class event data loaded.');
            },
            { timezone: 'America/Argentina/Buenos_Aires' }
        );
    }

    private async updateNextClassData() {
        child_process.spawn('python3', [
            './submodules/next_class_info_scraper.py',
        ]);
    }

    public logHelp(creator: string, helper: string, end: string) {
        this.logger.info(
            `Logging help asked by ${creator} helped by Grupo ${helper} (${end})`
        );
        if (creator.split(' ').length > 1) {
            creator = creator.split(' ')[1];
        }
        child_process.spawn('python3', [
            `./scripts/help_logger.py`,
            creator,
            end,
            helper,
        ]);
        this.logger.success('Help logged.');
    }
}

export { Bot as AlgoBot };
