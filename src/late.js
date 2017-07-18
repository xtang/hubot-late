"use strict";

const fs = require("fs");
const moment = require("moment");
const remove = require("lodash.remove");
const dataFilePath = "./data/late.json";

(function ensureJsonFile() {
  try {
    JSON.parse(fs.readFileSync(dataFilePath));
  } catch (err) {
    fs.writeFileSync(dataFilePath, JSON.stringify({}));
  }
})();

function renderMembers(members) {
  return members.map((id) => `@<=${id}=>`).join(' ');
}

function getAmountByTimes(times) {
  return Math.pow(2, times) * 10 - 10;
}

function checkAdmin (res) {
  const lateData = loadLateData();
  const admins = lateData["admins"] || []; // set admin list in late.json
  return admins.indexOf(res.message.user.id) !== -1;
}

function getDayString (res) {
  if (res.match[2]) {
    const date = parseInt(res.match[2].replace("号"));
    const today = new Date();
    return moment(today.setDate(date)).format('YYYY-MM-DD');
  } else {
    return moment().format('YYYY-MM-DD');
  }
}

function loadLateData () {
  return JSON.parse(fs.readFileSync(dataFilePath));
}

function saveLateData (data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data));
}

module.exports = (robot) => {
  robot.respond(/迟到(帮助| help)/i, (res) => {
    res.send(`迟到相关暗语说明：
1. @xxx 迟到了 => 添加当天迟到，HR 专用
2. @xxx 没迟到 => 取消当天迟到，HR 专用
3. @xxx n号迟到了 => 添加当月n号迟到，HR 专用
4. @xxx n号没迟到 => 取消当月n号迟到，HR 专用
5. @xxx 迟到几次了 => 查别人迟到
6. 谁迟到了 => 今天谁迟到了
7. 我迟到了 => 自己招了
8. 我迟到几次了 => 查自己迟到
9. 迟到汇总 => 月底算总帐，HR 专用
    `);
  });

  robot.respond(/(.+) (\d+号|)迟到了/i, (res) => {
    if (!checkAdmin(res)) {
      res.send(`你没有权限哦~`);
      return;
    }
    const lateData = loadLateData();
    const newLateGuys = res.match[1].replace(/@<=/g, '').replace(/=>/g, '').split(' ').filter(Boolean);
    const dayString = getDayString(res);
    let lateGuys = lateData[dayString] || [];
    lateGuys = Array.from(new Set(lateGuys.concat(newLateGuys)));
    lateData[dayString] = lateGuys;
    saveLateData(lateData);
    res.send(`好～已经记下了，${dayString} 迟到的人有 ${renderMembers(lateGuys)}`);
  });

  robot.respond(/我迟到了/i, (res) => {
    const lateData = loadLateData();
    const todayString = moment().format('YYYY-MM-DD');
    let lateGuys = lateData[todayString] || [];
    lateGuys = Array.from(new Set(lateGuys.concat(res.message.user.id)));
    lateData[todayString] = lateGuys;
    saveLateData(lateData);
    res.send(`好～已经记下了，你很自觉`);
  });

  robot.respond(/(.+) (\d+号|)没迟到/i, (res) => {
    if (!checkAdmin(res)) {
      res.send(`你没有权限哦~`);
      return;
    }
    const lateData = loadLateData();
    const luckyGuys = res.match[1].replace(/@<=/g, '').replace(/=>/g, '').split(' ').filter(Boolean);
    const dayString = getDayString(res);
    let lateGuys = lateData[dayString] || [];
    remove(lateGuys, (id) => luckyGuys.indexOf(id) > -1);
    lateData[dayString] = lateGuys;
    saveLateData(lateData);
    if (lateGuys.length === 0) {
      res.send(`好吧 ${dayString} 还没人迟到呢`);
    } else {
      res.send(`好～以后注意点啊，${dayString} 迟到的人有 ${renderMembers(lateGuys)}`);
    }
  });

  robot.respond(/谁迟到了/i, (res) => {
    const lateData = loadLateData();
    const todayString = moment().format('YYYY-MM-DD');
    let lateGuys = lateData[todayString] || [];
    if (lateGuys.length === 0) {
      res.send(`截至到目前，今天还没人迟到`);
    } else {
      res.send(`截至到目前，今天迟到的人有 ${renderMembers(lateGuys)}`);
    }
  });

  robot.respond(/(.*\s|我)迟到几次/i, (res) => {
    let days = [];
    const member = res.match[1] === '我' ?  res.message.user.id : res.match[1].replace(/@<=/g, '').replace(/=>/g, '').replace(/ /g, '');
    const lateData = loadLateData();
    const monthString = moment().format('YYYY-MM');
    Array(31).fill().forEach((_, index) => {
      const dayString = `0${index + 1}`.slice(-2);
      const lateGuys = lateData[`${monthString}-${dayString}`] || [];
      if (lateGuys.indexOf(member) !== -1) {
        days.push(`${dayString}号`);
      }
    });
    const length = days.length
    if (length === 0) {
      res.send(`截至到目前，${renderMembers([member])} 还没有迟到～`);
    } else {
      res.send(`截至到目前，${renderMembers([member])} 迟到了 ${length} 次，分别是 ${days.join(",")}\n需捐赠一熊房产 ${getAmountByTimes(length)} 大洋`);
    }
  });

  robot.respond(/迟到汇总/i, (res) => {
    if (!checkAdmin(res)) {
      res.send(`你没有权限哦~`);
      return;
    }
    let daysMap = {};
    const lateData = loadLateData();
    const monthString = moment().format('YYYY-MM');
    Array(31).fill().forEach((_, index) => {
      const dayString = `0${index + 1}`.slice(-2);
      const lateGuys = lateData[`${monthString}-${dayString}`] || [];
      lateGuys.forEach((member) => {
        daysMap[member] = (daysMap[member] || 0) + 1;
      })
    });
    let text = `这个月的迟到情况是：\n`
    Object.keys(daysMap).sort((a,b) => {
      if (daysMap[a] < daysMap[b]) {
        return 1;
      } else {
        return daysMap[a] === daysMap[b] ? 0 : -1;
      };
    }).forEach((member) => {
      const days = daysMap[member];
      text += `${renderMembers([member])} 迟到了 ${days} 次，需捐赠一熊房产 ${getAmountByTimes(days)} 大洋\n`;
    });
    text += `本月一熊房产累计收入: ${Object.values(daysMap).map(getAmountByTimes).reduce((a, b) => a + b)} 大洋`;
    res.send(text);
  });
}

