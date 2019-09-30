import { Signale } from 'signale';
import { Ora } from 'ora';
import { addWeeks, isBefore, endOfDay, toDate } from 'date-fns';

const chalk = require('chalk');

import { Config } from './config';
import ora = require('ora');
import { Item } from './item';
import { TaskPriority, Task } from './task';

const signale = new Signale({
  config: {
    displayLabel: false
  }
});

const { blue, green, grey, magenta, red, underline, yellow } = chalk;

const priorities = {
  1: 'green',
  2: 'yellow',
  3: 'red'
};

export class Renderer {
  private static _instance: Renderer
  private spinner: Ora;

  public static get instance(): Renderer {
    if (!this._instance) {
      this._instance = new Renderer();
    }

    return this._instance;
  }

  private constructor() {
    this.spinner = ora();
  }

  private get configuration(): any {
    return Config.instance.get();
  }

  private colorBoards(boards: any): any {
    return boards.map((x: any) => grey(x)).join(' ');
  }

  private isBoardComplete(items: Array<Item>): boolean {
    const { tasks, complete, notes } = this.getItemStats(items);
    return tasks === complete && notes === 0;
  }

  private getAge(birthday: number): string {
    const daytime: number = 24 * 60 * 60 * 1000;
    const age: number = Math.round(Math.abs(birthday - Date.now()) / daytime);
    return age === 0 ? '' : grey(`${age}d`);
  }

  private getRelativeHumanizedDate(dueDate: Date, now?: Date): string {
    if (!now) now = new Date();

    // get date diff
    const diffTime: number = dueDate.getTime() - now.getTime();
    const diffSeconds: number = Math.ceil(diffTime / 1000);
    let unit = '';
    let value = 0;

    if (Math.abs(diffSeconds) < 60) {
      value = diffSeconds;
      unit = 'seconds';
    } else if (Math.abs(diffSeconds) < 60 * 60) {
      value = Math.round(diffSeconds / 60);
      unit = 'minutes';
    } else if (Math.abs(diffSeconds) < 60 * 60 * 24) {
      value = Math.round(diffSeconds / (60 * 60));
      unit = 'hours';
    } else if (Math.abs(diffSeconds) < 60 * 60 * 24 * 7) {
      value = Math.round(diffSeconds / (60 * 60 * 24));
      unit = 'days';
    } else if (Math.abs(diffSeconds) < 60 * 60 * 24 * 30) {
      value = Math.round(diffSeconds / (60 * 60 * 24 * 7));
      unit = 'weeks';
    } else {
      value = Math.round(diffSeconds / (60 * 60 * 24 * 30));
      unit = 'months';
    }

    const absValue = Math.abs(value);
    unit = absValue === 1 ? unit.slice(0, unit.length - 1) : unit;
    const humanizedDate = value >= 1 ? `in ${value} ${unit}` : `${absValue} ${unit} ago`;
    return humanizedDate;
  }

  getDueDate(dueTimestamp: number): string {
    const now = new Date();
    const dueDate = toDate(dueTimestamp);

    const humanizedDate = this.getRelativeHumanizedDate(dueDate);
    const text = `(Due ${humanizedDate})`;

    const isSoon = isBefore(dueDate, addWeeks(now, 1));
    const isUrgent = isBefore(dueDate, endOfDay(now));

    if (isUrgent) {
      return red(underline(text));
    }

    if (isSoon) {
      return yellow(text);
    }

    return grey(text);
  }

  private getCorrelation(items: Array<Item>): string {
    const { tasks, complete } = this.getItemStats(items);
    return grey(`[${complete}/${tasks}]`);
  }

  private getItemStats(items: Array<Item>): any {
    let [tasks, complete, notes] = [0, 0, 0];

    items.forEach((item: Item) => {
      if (item.isTask) {
        tasks++;
        if (item instanceof Task && item.isComplete) {
          return complete++;
        }
      }

      return notes++;
    });

    return {
      tasks,
      complete,
      notes
    };
  }

  private getStar(item: Item): string {
    return item.isStarred ? yellow('★') : '';
  }

  private buildTitle(key: string, items: Array<Item>): any {
    const title =
      key === new Date().toDateString() ? `${underline(key)} ${grey('[Today]')}` : underline(key);
    const correlation = this.getCorrelation(items);
    return {
      title,
      correlation
    };
  }

  private buildPrefix(item: Item): string {
    const prefix: Array<string> = [];

    prefix.push(' '.repeat(4 - String(item.id).length));
    prefix.push(grey(`${item.id}.`));

    return prefix.join(' ');
  }

  private buildMessage(item: Item): string {
    const message: Array<string> = [];

    if (item instanceof Task) {
      if (!item.isComplete && item.priority > 1) {
        message.push(underline[priorities[item.priority]](item.description));
      } else {
        message.push(item.isComplete ? grey(item.description) : item.description);
      }

      if (!item.isComplete && item.priority > 1) {
        message.push(item.priority === 2 ? yellow('(!)') : red('(!!)'));
      }
    } else {
      message.push(item.description);
    }

    return message.join(' ');
  }

  private displayTitle(board: string, items: Array<Item>): void {
    const { title: message, correlation: suffix } = this.buildTitle(
      board,
      items
    );
    const titleObj = {
      prefix: '\n ',
      message,
      suffix
    };

    return signale.log(titleObj);
  }

  private displayItemByBoard(item: Item): void {
    const age = this.getAge(item.timestamp);
    let dueDate;
    if (item instanceof Task && item.dueDate !== 0 && !item.isComplete) {
      dueDate = this.getDueDate(item.dueDate);
    }

    const star = this.getStar(item);

    const prefix = this.buildPrefix(item);
    const message = this.buildMessage(item);
    let suffix;
    if (dueDate) {
      suffix = `${dueDate} ${star}`;
    } else {
      suffix = age.length === 0 ? star : `${age} ${star}`;
    }

    const msgObj = {
      prefix,
      message,
      suffix
    };

    if (item instanceof Task) {
      return item.isComplete ? signale.success(msgObj) : item.inProgress ? signale.await(msgObj) : item.isCanceled ? signale.fatal(msgObj) : signale.pending(msgObj);
    }

    return signale.note(msgObj);
  }

  private displayItemByDate(item: Item): void {
    const boards = item.boards.filter((x: string) => x !== 'My Board');
    const star = this.getStar(item);

    const prefix = this.buildPrefix(item);
    const message = this.buildMessage(item);
    const suffix = `${this.colorBoards(boards)} ${star}`;

    const msgObj = {
      prefix,
      message,
      suffix
    };

    if (item instanceof Task) {
      return item.isComplete ? signale.success(msgObj) : item.inProgress ? signale.await(msgObj) : item.isCanceled ? signale.fatal(msgObj) : signale.pending(msgObj);
    }

    return signale.note(msgObj);
  }

  public startLoading(): void {
    this.spinner.start();
  }

  public stopLoading(): void {
    this.spinner.stop();
  }

  public displayByBoard(data: any): void {
    this.stopLoading();
    Object.keys(data).forEach((board: string) => {
      if (
        this.isBoardComplete(data[board]) &&
        !this.configuration.displayCompleteTasks
      ) {
        return;
      }

      this.displayTitle(board, data[board]);
      data[board].forEach((item: Item) => {
        if (item instanceof Task && item.isComplete && !Config.instance.get().displayCompleteTasks) {
          return;
        }

        this.displayItemByBoard(item);
      });
    });
  }

  public displayByDate(data: any): void {
    this.stopLoading();
    Object.keys(data).forEach((date: string) => {
      if (
        this.isBoardComplete(data[date]) &&
        !Config.instance.get().displayCompleteTasks
      ) {
        return;
      }

      this.displayTitle(date, data[date]);
      data[date].forEach((item: Item) => {
        if (
          item instanceof Task &&
          item.isTask &&
          item.isComplete &&
          !Config.instance.get().displayCompleteTasks
        ) {
          return;
        }

        this.displayItemByDate(item);
      });
    });
  }

  public displayStats(percent: number, complete: number, inProgress: number, pending: number, notes: number): void {
    if (!Config.instance.get().displayProgressOverview) {
      return;
    }

    percent = percent >= 75 ? green(`${percent}%`) : percent >= 50 ? yellow(`${percent}%`) : `${percent}%`;

    const status: Array<string> = [
      `${green(complete)} ${grey('done')}`,
      `${blue(inProgress)} ${grey('in-progress')}`,
      `${magenta(pending)} ${grey('pending')}`,
      `${blue(notes)} ${grey(notes === 1 ? 'note' : 'notes')}`
    ];

    if (complete !== 0 && inProgress === 0 && pending === 0 && notes === 0) {
      signale.log({
        prefix: '\n ',
        message: 'All done!',
        suffix: yellow('★')
      });
    }

    if (pending + inProgress + complete + notes === 0) {
      signale.log({
        prefix: '\n ',
        message: 'Type `tl --help` to get started!',
        suffix: yellow('★')
      });
    }

    signale.log({
      prefix: '\n ',
      message: grey(`${percent} of all tasks complete.`)
    });
    signale.log({
      prefix: ' ',
      message: status.join(grey(' · ')),
      suffix: '\n'
    });
  }

  public markComplete(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message: string = `Checked ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markInComplete(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message: string = `Unchecked ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markStarted(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Started ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markPaused(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Paused ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markCanceled(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Canceled ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markRevived(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Revived ${ids.length > 1 ? 'tasks' : 'task'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markStarred(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Starred ${ids.length > 1 ? 'items' : 'item'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public markUnstarred(ids: Array<number>): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Unstarred ${ids.length > 1 ? 'items' : 'item'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  invalidCustomAppDir(path: string): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', red(path)];
    const message = 'Custom app directory was not found on your system:';
    signale.error({
      prefix,
      message,
      suffix
    });
  }

  invalidFirestoreConfig(): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', ''];
    const message = 'Firestore config contains error';
    signale.error({
      prefix,
      message,
      suffix
    });
  }

  public invalidID(id: number): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(id)];
    const message = 'Unable to find item with id:';
    signale.error({
      prefix,
      message,
      suffix
    });
  }

  public invalidIDRange(range: string): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(range)];
    const message = 'Unable to resolve ID range:';
    signale.error({
      prefix,
      message,
      suffix
    });
  }

  public invalidPriority(): void {
    this.stopLoading();
    const prefix = '\n';
    const message = 'Priority can only be 1, 2 or 3';
    signale.error({
      prefix,
      message
    });
  }

  public invalidDateFormat(date: string): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(date)];
    const message = 'Unable to parse date:';
    signale.error({
      prefix,
      message,
      suffix
    });
  }

  public successCreate(item: Item): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(item.id)];
    const message = `Created ${item.isTask ? 'task:' : 'note:'}`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successEdit(id: number): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(id)];
    const message = 'Updated description of item:';
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successDelete(ids: Array<number>): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message: string = `Deleted ${ids.length > 1 ? 'items' : 'item'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successMove(ids: Array<number>, boards: Array<string>): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(boards.join(', '))];
    const message: string = `Move item: ${grey(ids.join(', '))} to`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successPriority(ids: Array<number>, priority: TaskPriority): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const prefix: string = '\n';
    const message = `Updated priority of ${
      ids.length > 1 ? 'tasks' : 'task'
      }: ${grey(ids.join(', '))} to`;
    const suffix =
      priority === 3 ? red(TaskPriority[priority]) : priority === 2 ? yellow(TaskPriority[priority]) : green(TaskPriority[priority]);
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successDueDate(ids: Array<number>, dueDate: Date): void {
    this.stopLoading();
    if (ids.length === 0) {
      return;
    }

    const prefix = '\n';
    const message = `Updated duedate of ${
      ids.length > 1 ? 'tasks' : 'task'
      }: ${grey(ids.join(', '))} to`;
    const suffix = dueDate;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successRestore(ids: Array<number>): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Restored ${ids.length > 1 ? 'items' : 'item'}:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successCopyToClipboard(ids: Array<number>): void {
    this.stopLoading();
    const [prefix, suffix] = ['\n', grey(ids.join(', '))];
    const message = `Copied the ${
      ids.length > 1 ? 'descriptions of items' : 'description of item'
      }:`;
    signale.success({
      prefix,
      message,
      suffix
    });
  }

  public successRearrangeIDs(): void {
    this.stopLoading();
    const prefix = '\n';
    const message = `Rearranged ids of all items`;
    signale.success({
      prefix,
      message
    });
  }
}
