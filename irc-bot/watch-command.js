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


const parse = require('./parse');

const Channel = require('../models/channel');
const User = require('../models/user');
const Battle = require('../models/battle');

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
const watchlist = {};


module.exports = async function(bot, from, to, args) {
  const {server, options, argv, help} = await parse(bot, '!watch [battle id]', [
    ['d', 'defender', 'Defender side (default)'],
    ['a', 'attacker', 'Attacker side'],
    ['L', 'list', 'List battles in watchlist (default)'],
    ['w', 'watch', 'Add battle to watchlist (default if battle id is given)'],
    ['l', 'light', 'Show status on T-10, T-5 and T-2 only'],
    ['f', 'full', 'Show status on all intervals (default)'],
    ['r', 'remove', 'Remove battle from watchlist (battle id required)'],
  ], args, 0, 1, to, true);

  if (help) {
    return;
  }

  const channel = await Channel.findOne({name: to}).populate({
    path: 'countries',
    match: {server: server._id},
  });

  if (!channel) {
    throw new Error('Channel not registered in database.');
  } else if (!channel.countries.length) {
    throw new Error('Channel not registered for given server.');
  }

  const user = await User.findOne({
    nicknames: from,
  });

  if (!user) {
    throw new Error('Nickname is not registered.');
  }

  const countries = [];

  for (const country of channel.countries) {
    if (country.getUserAccessLevel(user) > 0) {
      countries.push(country);
    }
  }

  if (!countries.length) {
    throw new Error('Permission denied.');
  } else if (countries.length > 1) {
    throw new Error('Failed, you have access on multiple countries.');
  }

  const [country] = countries;

  await country.populate('server organizations').execPopulate();

  let j = -1;
  const l = country.channels.length;
  for (let i = 0; i < l; i++) {
    if (country.channels[i].channel.equals(channel.id)) {
      j = i;
    }
  }

  if (j < 0 || !country.channels[j].types.includes('military')) {
    throw new Error('Military commands are not allowed for the given server in this channel.');
  }


  const side =
    options.defender ? 'defender' :
    options.attacker ? 'attacker' :
    'defender';

  const mode =
    options.light ? 'light' :
    options.full ? 'full' :
    'full';

  const battleId = !options.list && argv.length > 0 ? parseInt(argv[0]) : 0;

  if (options.list ||
      (!options.watch && !options.remove && argv.length < 1)) {
    const battles = await Battle.find({
      country: country,
      channel: channel,
    });

    const l = battles.length;
    if (l === 0) {
      bot.say(to, 'Watchlist is empty');
      return;
    }

    for (let i = 0; i < l; i++) {
      bot.say(
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
      battleId: battleId,
      country: country,
      channel: channel,
    });

    if (!battle || !watchlist[battle.id]) {
      throw new Error('Battle not found in watchlist');
    }

    clearTimeout(watchlist[battle.id]);

    await battle.remove();

    bot.say(to, 'Battle deleted from watchlist');
    delete watchlist[battle.id];
  } else {
    let battle = await Battle.findOne({
      battleId: battleId,
      country: country,
      channel: channel,
    });

    if (battle) {
      if (watchlist[battle.id] !== null) {
        clearTimeout(watchlist[battle.id]);
        battle.remove();
        delete watchlist[battle.id];
      } else {
        throw new Error('Failed to delete previous watch. Please try again.');
      }
    }

    battle = await Battle.create({
      battleId: battleId,
      country: country,
      channel: channel,
      side: side,
      mode: mode,
    });

    await battle.populate('channel').execPopulate();

    if (!country.organizations.length) {
      throw new Error('Failed to watch battle: Organization not found.');
    }

    await watchBattle(bot, country.organizations[0], battle);
  }
};

function watchBattleRound(
    bot, organization, battle, battleInfo, battleRoundInfo, time
) {
  const timeout = async function(watchpoint) {
    watchlist[battle.id] = null;
    const battleRoundInfo =
      await organization.getBattleRoundInfo(battleInfo.roundId);

    let frozen = false;

    if (battleRoundInfo.remainingTimeInSeconds === time && time > 0) {
      frozen = true;
    } else if (watchpoint === 600) {
      bot.callEveryone(
          battle.channel.name,
          'T-10 --- Get ready to fight!!!');
    } else if (watchpoint === 300) {
      bot.callEveryone(
          battle.channel.name,
          'T-5 --- Standby --- hit at T-2 if bar is below 52%!!!');
    } else if (watchpoint === 120) {
      const {defenderScore, attackerScore, totalScore} = battleRoundInfo;

      let percentage = 0;

      if (battle.side === 'defender') {
        percentage = defenderScore / totalScore;
      } else if (battle.side === 'attacker') {
        percentage = attackerScore / totalScore;
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

      bot.callEveryone(battle.channel.name, `T-2 --- ${command}`);
    }

    if (!frozen) {
      await bot.displayBattleStatus(
          battle.channel.name, organization,
          battle, battleInfo, battleRoundInfo);
    }

    watchBattleRound(
        bot, organization, battle, battleInfo, battleRoundInfo,
        battleRoundInfo.remainingTimeInSeconds);
  };

  const l = watchpoints[battle.mode].length;
  for (let i = 0; i < l; i++) {
    if (battleRoundInfo.remainingTimeInSeconds > watchpoints[battle.mode][i]) {
      watchlist[battle.id] = setTimeout(
          timeout,
          (battleRoundInfo.remainingTimeInSeconds -
            watchpoints[battle.mode][i]) * 1000,
          watchpoints[battle.mode][i]);

      return;
    }
  }

  const {defenderScore, attackerScore} = battleRoundInfo;

  const winner = defenderScore >= attackerScore ?
    battleInfo.defender : battleInfo.attacker;

  bot.say(battle.channel.name, `The round has ended in favor of ${winner}`);

  watchlist[battle.id] = setTimeout(() => {
    watchlist[battle.id] = null;
    watchBattle(bot, organization, battle);
  }, 30000);
}

async function watchBattle(bot, organization, battle) {
  const battleInfo = await organization.getBattleInfo(battle.battleId);

  if (!battle.label) {
    const side = battle.side === 'defender' ?
      battleInfo.defender : battleInfo.attacker;
    battle.label = `${battleInfo.label} (${side})`;
    await battle.save();
  }

  const battleRoundInfo =
      await organization.getBattleRoundInfo(battleInfo.roundId);

  if (battleRoundInfo.remainingTimeInSeconds < 0) {
    const {defenderScore, attackerScore} = battleRoundInfo;

    const winner = defenderScore >= attackerScore ?
      battleInfo.defender : battleInfo.attacker;

    bot.say(battle.channel.name, `The battle has ended in favor of ${winner}`);

    await battle.remove();
    if (watchlist.hasOwnProperty(battle.id)) {
      delete watchlist[battle.id];
    }

    return;
  }

  await bot.displayBattleStatus(
      battle.channel.name, organization, battle, battleInfo, battleRoundInfo);
  watchBattleRound(
      bot, organization, battle, battleInfo, battleRoundInfo,
      battleRoundInfo.remainingTimeInSeconds);
}

module.exports.watchBattle = watchBattle;
