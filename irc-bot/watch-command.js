/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2015  Arnel A. Borja <kyoushuu@yahoo.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


import ChannelCommand from './channel-command';

import Battle from '../models/battle';
import Channel from '../models/channel';

const watchpoints = {
  full: [
    6000, 4800, 3600,
    3000, 2400, 1800,
    1500, 1200, 900, 600, 300,
    270, 240, 210, 180, 150, 120,
    105, 90, 75, 60,
    50, 40, 30,
    24, 18, 12, 6, 0,
    -6, -12,
  ],
  light: [
    600, 300, 120, -12,
  ],
};


class WatchCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'watch', {
      params: [{name: 'battleId', parser: parseInt, required: false}],
      options: [
        ['d', 'defender', 'Defender side (default)'],
        ['a', 'attacker', 'Attacker side'],
        ['L', 'list', 'List battles in watchlist (default)'],
        ['w', 'watch', 'Add battle to watchlist (default if battle id is given)'],
        ['l', 'light', 'Show status on T-10, T-5 and T-2 only'],
        ['f', 'full', 'Show status on all intervals (default)'],
        ['r', 'remove', 'Remove battle from watchlist (battle id required)'],
      ],
      requireCountryAccessLevel: 1,
      requireCountryChannelType: 'military',
    });

    this.watchlist = {};

    this.bot.addListener('join', (channel, nick, message) => {
      this.onJoin(channel, nick, message).catch((error) => {
        console.log(error);
      });
    });

    this.bot.addListener('part', (channel, nick, reason, message) => {
      this.onPart(channel, nick, reason, message).catch((error) => {
        console.log(error);
      });
    });
  }


  async onJoin(chan, nick, message) {
    if (nick !== this.bot.nick) {
      return;
    }

    const channel = await Channel.findOne({name: chan});

    if (!channel) {
      return;
    }

    try {
      await this.resumeWatchChannelBattles(channel);
    } catch (error) {
      this.bot.say(channel.name, `Failed to watch battles: ${error.message}`);
    }
  }

  async onPart(chan, nick, reason, message) {
    if (nick !== this.bot.nick) {
      return;
    }

    const channel = await Channel.findOne({name: chan});

    if (!channel) {
      return;
    }

    try {
      await this.stopWatchChannelBattles(channel);
    } catch (error) {
      this.bot.say(channel.name, `Failed to unwatch battles: ${error.message}`);
    }
  }


  async run(from, to, {server, country, channel, user, params, options, argv}) {
    await country.populate('server organizations').execPopulate();

    const side =
      options.defender ? 'defender' :
      options.attacker ? 'attacker' :
      'defender';

    const mode =
      options.light ? 'light' :
      options.full ? 'full' :
      'full';

    const {battleId} = params;

    if (options.list || !options.watch && !options.remove && argv.length < 1) {
      const battles = await Battle.find({
        country,
        channel,
      });

      const l = battles.length;
      if (l === 0) {
        this.bot.say(to, 'Watchlist is empty');
        return;
      }

      for (let i = 0; i < l; i++) {
        this.bot.say(
            to,
            `${i + 1}. ` +
            `${country.server.address}/battle.html?id=${battles[i].battleId} - ` +
            `${battles[i].label ? battles[i].label : battles[i].side}`);
      }
    } else if (argv.length < 1) {
      throw new Error('Not enough arguments');
    } else if (isNaN(battleId) || battleId < 1) {
      throw new Error('Invalid battle id');
    } else if (options.remove) {
      const battle = await Battle.findOne({
        battleId,
        country,
        channel,
      });

      if (!battle || !this.watchlist[battle.id]) {
        throw new Error('Battle not found in watchlist');
      }

      clearTimeout(this.watchlist[battle.id]);

      await battle.remove();

      this.bot.say(to, 'Battle deleted from watchlist');
      delete this.watchlist[battle.id];
    } else {
      let battle = await Battle.findOne({
        battleId,
        country,
        channel,
      });

      if (battle) {
        if (this.watchlist[battle.id] !== null) {
          clearTimeout(this.watchlist[battle.id]);
          battle.remove();
          delete this.watchlist[battle.id];
        } else {
          throw new Error('Failed to delete previous watch. Please try again.');
        }
      }

      battle = await Battle.create({
        battleId,
        country,
        channel,
        side,
        mode,
      });

      await battle.populate('channel').execPopulate();

      if (!country.organizations.length) {
        throw new Error('Failed to watch battle: Organization not found.');
      }

      await this.watchBattle(country.organizations[0], battle);
    }
  }

  watchBattleRound(organization, battle, battleInfo, battleRoundInfo, time) {
    const timeout = async (watchpoint) => {
      this.watchlist[battle.id] = null;
      const battleRoundInfo =
        await organization.getBattleRoundInfo(battleInfo.roundId);

      let frozen = false;

      if (battleRoundInfo.remainingTimeInSeconds === time && time > 0) {
        frozen = true;
      } else if (watchpoint === 600) {
        this.bot.callEveryone(
            battle.channel.name,
            'T-10 --- Get ready to fight!!!');
      } else if (watchpoint === 300) {
        this.bot.callEveryone(
            battle.channel.name,
            'T-5 --- Standby --- hit at T-2 if bar is below 52%!!!');
      } else if (watchpoint === 120) {
        const {scores} = battleRoundInfo;

        let percentage = 0;

        if (battle.side === 'defender') {
          percentage = scores.defender / scores.total;
        } else if (battle.side === 'attacker') {
          percentage = scores.attacker / scores.total;
        }

        if (!isFinite(percentage)) {
          percentage = 0;
        }

        let command;

        if (percentage < 0.52) {
          command = 'Start hitting!!!';
        } else {
          command = 'Hold your hits --- Only hit when bar drops below 52%!!!';
        }

        this.bot.callEveryone(battle.channel.name, `T-2 --- ${command}`);
      }

      if (!frozen) {
        await this.bot.displayBattleStatus(
            battle.channel.name, organization,
            battle, battleInfo, battleRoundInfo);
      }

      this.watchBattleRound(
          organization, battle, battleInfo, battleRoundInfo,
          battleRoundInfo.remainingTimeInSeconds);
    };

    const l = watchpoints[battle.mode].length;
    for (let i = 0; i < l; i++) {
      if (battleRoundInfo.remainingTimeInSeconds >
          watchpoints[battle.mode][i]) {
        this.watchlist[battle.id] = setTimeout(
            timeout,
            (battleRoundInfo.remainingTimeInSeconds -
              watchpoints[battle.mode][i]) * 1000,
            watchpoints[battle.mode][i]);

        return;
      }
    }

    const {scores} = battleRoundInfo;

    const winner = scores.defender >= scores.attacker ?
      battleInfo.defender.name : battleInfo.attacker.name;

    this.bot.say(battle.channel.name, `The round has ended in favor of ${winner}`);

    this.watchlist[battle.id] = setTimeout(() => {
      this.watchlist[battle.id] = null;
      this.watchBattle(organization, battle);
    }, 30000);
  }

  async watchBattle(organization, battle) {
    const battleInfo = await organization.getBattleInfo(battle.battleId);
    const {label, roundId, defender, attacker, scores} = battleInfo;

    if (!battle.label) {
      const side = battle.side === 'defender' ? defender.name : attacker.name;
      battle.label = `${label} (${side})`;
      await battle.save();
    }

    await battle.populate('channel').execPopulate();

    if (!roundId) {
      const winner = scores.defender >= scores.attacker ?
        defender.name : attacker.name;

      this.bot.say(battle.channel.name, `The battle in ${label} has ended in favor of ${winner}`);

      await battle.remove();
      if (this.watchlist.hasOwnProperty(battle.id)) {
        delete this.watchlist[battle.id];
      }

      return;
    }

    const battleRoundInfo =
        await organization.getBattleRoundInfo(roundId);

    await this.bot.displayBattleStatus(
        battle.channel.name, organization, battle, battleInfo, battleRoundInfo);
    this.watchBattleRound(
        organization, battle, battleInfo, battleRoundInfo,
        battleRoundInfo.remainingTimeInSeconds);
  }

  async resumeWatchChannelBattles(channel) {
    const battles = await Battle.find({
      channel,
    }).populate('country');

    await Promise.all(battles
        .map((b) => b.country.populate('organizations').execPopulate()));
    await Promise.all(battles
        .filter((b) => b.country.organizations.length)
        .map((b) => this.watchBattle(b.country.organizations[0], b)));
  }

  async stopWatchChannelBattles(channel) {
    const battles = await Battle.find({
      channel,
    });

    for (const battle of battles) {
      if (this.watchlist[battle.id] !== null) {
        clearTimeout(this.watchlist[battle.id]);
        delete this.watchlist[battle.id];
      }
    }
  }
}


export default WatchCommand;
