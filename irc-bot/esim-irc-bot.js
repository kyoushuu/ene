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


import {colors} from 'irc';
const {codes} = colors;
import {parse} from 'shell-quote';
import numeral from 'numeral';

import Channel from '../models/channel';

import RizonIRCBot from './rizon-irc-bot';

import MotivateCommand from './motivate-command';
import DonateCommand from './donate-command';
import SupplyCommand from './supply-command';
import SupplyCommuneCommand from './supply-commune-command';
import BattleCommand from './battle-command';
import WatchCommand from './watch-command';
import CallCommand from './call-command';

import {add as AddNicknameCommand} from './nickname-command';
import AnnounceCommand from './announce-command';
import JoinCommand from './join-command';
import PartCommand from './part-command';
import SayCommand from './say-command';
import ActCommand from './act-command';


class EsimIRCBot extends RizonIRCBot {
  constructor(server, nickname, password, options) {
    super(server, nickname, password, options);

    this.nickFilterList = [];

    this.commands = {
      channel: {
        '!motivate': new MotivateCommand(this),
        '!donate': new DonateCommand(this),
        '!supply': new SupplyCommand(this),
        '!supply-commune': new SupplyCommuneCommand(this),
        '!battle': new BattleCommand(this),
        '!watch': new WatchCommand(this),
        '!call': new CallCommand(this),
      },
      priv: {
        'add-nickname': new AddNicknameCommand(this),
        'announce': new AnnounceCommand(this),
        'join': new JoinCommand(this),
        'part': new PartCommand(this),
        'say': new SayCommand(this),
        'act': new ActCommand(this),
      },
    };
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

    if (this.commands.channel.hasOwnProperty(argv[0])) {
      const command = this.commands.channel[argv[0]];
      const result = await command.parse(from, to, argv, message);

      if (result.help) {
        this.say(to, await command.getHelp());
        return;
      }

      await command.run(from, to, result);
    }
  }

  async onPrivateMessage(from, message) {
    await super.onPrivateMessage(from, message);

    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (this.commands.priv.hasOwnProperty(argv[0])) {
      const command = this.commands.priv[argv[0]];
      const result = await command.parse(from, argv, message);

      if (result.help) {
        this.say(from, await command.getHelp());
        return;
      }

      await command.run(from, result);
    }
  }


  async joinChannels() {
    const channels = await Channel.find({});
    if (!channels || !channels.length) {
      return;
    }

    await Promise.all(channels
        .map((c) => c.keyword ? `${c.name} ${c.keyword}` : `${c.name}`)
        .map((c) => this.join(c)));
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


export default EsimIRCBot;
