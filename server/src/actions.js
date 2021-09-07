const db = require("./db").getDb();
const path = require("path");

const Actions = {
  getAll: () => {
    const actions = db
      .prepare(
        `
    select *
    from actions
    `
      )
      .all();
    return actions;
  },
  get: () => {
    const actions = db
      .prepare(
        `
    select actions.actionName, id
    from actions
    where actions.deleted = false
    `
      )
      .all();
    return actions;
  },
  add: name => {
    db.prepare(
      `
    insert into actions(actionName, deleted)
    values (?, ?);
    `
    ).run(name, 0);
  },
  rename: (name, id) => {
    db.prepare(
      `
    update actions
      set actionName = ?
    where actions.id = ?;
    `
    ).run(name, id);
  },
  toggleDelete: id => {
    db.prepare(
      `
      update actions
        set deleted = NOT deleted
      where actions.id = ?;
      `
    ).run(id);
  }
};

module.exports = Actions;
