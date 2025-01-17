import {
    MessageButton,
    ButtonInteraction,
    GuildMember,
    VoiceChannel,
    TextChannel,
} from 'discord.js';
import { client } from '../../index';

export const execute = async (interaction: ButtonInteraction) => {
    const consultor = interaction.member as GuildMember;
    if (client.queryQueue.isEmpty()) {
        await interaction.reply({
            content: 'Nadie necesita ayuda por el momento!',
            ephemeral: true,
        });
        return;
    } else if (!consultor.voice.channel) {
        await interaction.reply({
            content:
                'Debes estar en un canal de voz para poder atender una consulta por voz!',
            ephemeral: true,
        });
        return;
    }
    let consultee: GuildMember = client.queryQueue.next() as GuildMember;
    const group = consultee.roles.cache.find((role) =>
        role.name.startsWith('Grupo')
    );

    client.logHelp(
        group ? group.name.split(' ')[1] : consultee.displayName,
        consultor.displayName,
        'Brindada'
    );

    if (group) {
        let groupVoiceChannel = interaction.guild!.channels.cache.find(
            (channel) => channel.name === group.name
        ) as VoiceChannel;

        while (!groupVoiceChannel && !client.queryQueue.isEmpty()) {
            await interaction.reply({
                content:
                    'Los alumnos del grupo que solició ayuda ya no están conectados a un canal de voz!',
                ephemeral: true,
            });
            consultee = client.queryQueue.next() as GuildMember;
            groupVoiceChannel = interaction.guild!.channels.cache.find(
                (channel) => channel.name === group.name
            ) as VoiceChannel;
        }

        if (groupVoiceChannel) {
            await consultee.voice.setChannel(groupVoiceChannel);
            await interaction.reply({
                content: `Estás atendiendo a ${consultee.displayName}`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: 'Nadie necesita ayuda por el momento!',
                ephemeral: true,
            });
        }

        consultor.voice.setChannel(consultee.voice.channel as VoiceChannel);
    } else {
        while (!consultee.voice.channel && !client.queryQueue.isEmpty()) {
            await interaction.reply({
                content: `${consultee.displayName} se desconectó del canal de voz`,
                ephemeral: true,
            });
            consultee = client.queryQueue.next() as GuildMember;
        }

        if (consultee.voice.channel) {
            consultor.voice.setChannel(consultee.voice.channel as VoiceChannel);
            await interaction.reply({
                content: `Estás atendiendo a ${consultee.displayName}`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: 'Nadie necesita ayuda por el momento!',
                ephemeral: true,
            });
        }
    }
    const queryLogTextChannel = interaction.guild!.channels.cache.find(
        (channel) => channel.id === client.config.queryLogTextChannelID
    ) as TextChannel;
    await queryLogTextChannel!.send(
        `✅ ${consultor.displayName} atendió la consulta de ${
            group ? 'el ' + group.name : consultee.displayName
        }.`
    );
};

export const data = new MessageButton()
    .setCustomId('dequeue')
    .setLabel('Atender Próximo Grupo')
    .setStyle('PRIMARY');
