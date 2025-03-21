import { Taskline } from '../src/taskline';
import { Item } from '../src/item';
import { Task } from '../src/task';
import { Helper } from './helper';
import { Note } from '../src/note';

const helper = new Helper();
const taskline = new Taskline();

describe('Test check functionality', () => {
  //  Disable output
  process.stdout.write = jest.fn();
  //  Disable output ora problem also jest has no output than
  //  process.stderr.write = jest.fn();

  beforeAll(async done => {
    await helper.clearStorage();
    const data: Array<Item> = new Array<Item>();
    data.push(new Note({
      id: 1,
      date: 'Mon Sep 02 2019',
      timestamp: 1567434272855,
      description: 'Test Note',
      isStarred: false,
      boards: ['My Board']
    }));

    data.push(new Task({
      id: 2,
      date: 'Mon Sep 02 2019',
      timestamp: 1567434272855,
      description: 'Test Task',
      isStarred: false,
      boards: ['My Board'],
      dueDate: 0,
      isComplete: false,
      inProgress: false,
      priority: 1
    }));

    data.push(new Task({
      id: 3,
      date: 'Mon Sep 02 2019',
      timestamp: 1567434272855,
      description: 'Second Test Task',
      isStarred: false,
      boards: ['My Board'],
      dueDate: 0,
      isComplete: false,
      inProgress: false,
      priority: 1
    }));

    data.push(new Task({
      id: 4,
      date: 'Mon Sep 02 2019',
      timestamp: 1567434272855,
      description: 'Third Test Task',
      isStarred: false,
      boards: ['My Board'],
      dueDate: 0,
      isComplete: false,
      inProgress: false,
      isCanceled: false,
      priority: 1
    }));

    await helper.setData(data);
    done();
  });

  it('should cancel one task', () => {
    return taskline.cancelTasks('2').then(() => {
      return helper.getData([2]).then(data => {
        expect((data[0] as Task).inProgress).toBe(false);
        expect((data[0] as Task).isCanceled).toBe(true);
        expect((data[0] as Task).isComplete).toBe(false);
      });
    });
  });

  it('should cancel multiple tasks', () => {
    return taskline.cancelTasks('3,4').then(() => {
      return helper.getData([3,4]).then(data => {
        expect((data[0] as Task).inProgress).toBe(false);
        expect((data[0] as Task).isCanceled).toBe(true);
        expect((data[0] as Task).isComplete).toBe(false);
        expect((data[1] as Task).inProgress).toBe(false);
        expect((data[1] as Task).isCanceled).toBe(true);
        expect((data[1] as Task).isComplete).toBe(false);
      });
    });
  });

  it('should cancel multiple tasks by id range', () => {
    return taskline.cancelTasks('2-4').then(() => {
      return helper.getData([2,3,4]).then(data => {
        expect((data[0] as Task).isCanceled).toBe(false);
        expect((data[1] as Task).isCanceled).toBe(false);
        expect((data[2] as Task).isCanceled).toBe(false);
      });
    });
  });

  it('should cancel multiple tasks by id range and list', () => {
    return taskline.cancelTasks('2,3-4').then(() => {
      return helper.getData([2,3,4]).then(data => {
        expect((data[0] as Task).isCanceled).toBe(true);
        expect((data[1] as Task).isCanceled).toBe(true);
        expect((data[2] as Task).isCanceled).toBe(true);
      });
    });
  });

  it('should delete all canceled tasks', () => {
    return helper.getData([2,3,4]).then(data => {
      const oldData = JSON.parse(JSON.stringify(data));
      
      return taskline.clear().then(() => {
        return helper.getData().then(data => {
          return helper.getArchive().then(archive => {
            expect(data.length).toBe(1);
            oldData[0].id -= 1;
            expect(JSON.parse(JSON.stringify(archive[0]))).toMatchObject(oldData[0]);
            oldData[1].id -= 1;
            expect(JSON.parse(JSON.stringify(archive[1]))).toMatchObject(oldData[1]);
            oldData[2].id -= 1;
            expect(JSON.parse(JSON.stringify(archive[2]))).toMatchObject(oldData[2]);
          });
        });
      });
    });
  });

  it('should try to cancel a nonexisting item', () => {
    expect(taskline.cancelTasks('5')).rejects.toMatchObject({
      message: 'Invalid InputIDs'
    });
  });

  it('should try to cancel with invalid id range', () => {
    expect(taskline.cancelTasks('1-b')).rejects.toMatchObject({
      message: 'Invalid Input ID Range'
    });
  });

  afterAll(done => {
    helper.resetConfig();
    done();
  });
});
