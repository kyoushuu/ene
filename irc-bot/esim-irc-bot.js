/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2017  Arnel A. Borja <kyoushuu@yahoo.com>
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


const {colors: {codes}} = require('irc');
const {parse} = require('shell-quote');
const numeral = require('numeral');

const Channel = require('../models/channel');

const RizonIRCBot = require('./rizon-irc-bot');


const commands = {
  channel: {
    '!motivate': require('./motivate-command'),
    '!donate': require('./donate-command'),
    '!supply': require('./supply-command'),
    '!supply-commune': require('./supply-commune-command'),
    '!battle': require('./battle-command'),
    '!watch': require('./watch-command'),
    '!call': require('./call-command'),
  },
  priv: {
    'add-nickname': require('./nickname-command').add,
    'announce': require('./announce-command'),
    'join': require('./join-command'),
    'part': require('./part-command'),
    'say': require('./say-command'),
    'act': require('./act-command'),
  },
};


class EsimIRCBot extends RizonIRCBot {
  constructor(server, nickname, password, options) {
    super(server, nickname, password, options);

    this.nickFilterList = [];
  }


  async onRegistered() {
    await super.onRegistered();

    await this.joinChannels();
  }

  async onChannelMessage(from, to, message) {
    await super.onChannelMessage(from, to, message);

    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (commands.channel.hasOwnProperty(argv[0])) {
      const identified = await this.isNickIdentified(from);

      if (!identified) {
        throw new Error('Identify with NickServ first.');
      }

      await commands.channel[argv[0]](this, from, to, argv, message);
    }
  }

  async onPrivateMessage(from, message) {
    await super.onPrivateMessage(from, message);

    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (commands.priv.hasOwnProperty(argv[0])) {
      const identified = await this.isNickIdentified(from);

      if (!identified) {
        throw new Error('Identify with NickServ first.');
      }

      commands.priv[argv[0]](this, from, argv, message);
    }
  }


  async joinChannels() {
    const channels = await Channel.find({});
    if (!channels || !channels.length) {
      return;
    }

    for (const channel of channels) {
      let joinArgs = channel.name;
      if (channel.keyword) {
        joinArgs += ` ${channel.keyword}`;
      }

      await this.join(joinArgs);
    }
  }


  async callEveryone(channel, message) {
    const names = await this.names(channel);

    this.say(
        channel,
        `${codes.bold}Listen up! ${codes.reset}${names.join(' ')}`);

    if (message) {
      this.say(
          channel,
          `${codes.bold + codes.black},07` +
          `############# ${message} #############` +
          `${codes.reset}`);
    }
  }

  async displayBattleStatus(
      channel,
      organization,
      battle,
      battleInfo = undefined,
      battleRoundInfo = undefined) {
    await organization.populate('country').execPopulate();
    await organization.country.populate('server').execPopulate();

    const {server} = organization.country;

    battleInfo = battleInfo ||
        await organization.getBattleInfo(battle.battleId);

    if (battleInfo.roundId) {
      battleRoundInfo = battleRoundInfo ||
          await organization.getBattleRoundInfo(battleInfo.roundId);
    }


    let bonusRegion = null;

    if (battleInfo.type === 'resistance' ||
        battleInfo.type === 'direct' && battle.side === 'defender') {
      bonusRegion = `${battleInfo.label}, ${battleInfo.defender}`;
    } else if (battleInfo.type === 'direct' && battle.side === 'attacker') {
      const allies = battleInfo.attackerAllies.slice();
      allies.unshift(battleInfo.attacker);

      bonusRegion = await server.getAttackerBonusRegion(battleInfo.id, allies);
    }


    const {defenderScore, attackerScore, totalScore} =
      battleRoundInfo || battleInfo;

    let wall = 0;
    let percentage = 0;

    if (battle.side === 'defender') {
      wall = defenderScore - attackerScore;
      percentage = defenderScore / totalScore;
    } else if (battle.side === 'attacker') {
      wall = attackerScore - defenderScore;
      percentage = attackerScore / totalScore;
    }

    if (!isFinite(percentage)) {
      percentage = 0;
    }


    const {remainingTimeInSeconds = 0} = battleRoundInfo || {};
    const time = Math.max(0, remainingTimeInSeconds);

    const {underline: ul, bold, reset} = codes;
    const {dark_red: dr, dark_green: dg} = codes;

    const defenderSide = battle.side === 'defender';
    const winning = percentage > 0.5;
    const status = winning ? 'Winning' : 'Losing';

    const {round, defender, defenderWins, attacker, attackerWins} = battleInfo;

    const urlSection = `${server.address}/battle.html?id=${battle.battleId}`;
    const summarySection =
        `${ul}${bold}${battleInfo.label}${reset} ` +
        `(${defenderSide ? defender : attacker}) - ` +
        `${bold}R${round}${reset} ` +
        `(${defenderSide ? dg : dr}${bold}${defenderWins}${reset}:` +
        `${defenderSide ? dr : dg}${bold}${attackerWins}${reset})`;
    const bonusSection =
        bonusRegion ? `${bold}Bonus: ${reset}${bonusRegion}` : null;
    const percentSection =
        `${bold}${winning ? dg : dr}${status}${reset}: ` +
        `${numeral(percentage).format('0.00%')}`;
    const wallSection =
        `${bold}Wall: ${winning ? dg : dr}` +
        `${numeral(wall).format('+0,0')}${reset}`;
    const timeSection =
        `${bold}Time: ${reset}0${numeral(time).format('00:00:00')}`;

    const sections = [
      urlSection,
      summarySection,
      bonusSection,
      percentSection,
      wallSection,
      timeSection,
    ].filter((value) => value !== null);

    this.say(channel, sections.join(' | '));
  }
}


module.exports = EsimIRCBot;
