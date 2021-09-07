create table Videos (
  id integer primary key autoincrement,
  videoName text not null,
  currentJson text not null,
  lastEdited real default 0.0
);

create table Events (
  id integer primary key, 
  eventName text not null,
  deleted boolean
);

create table Scenes (
  id integer primary key,
  sceneName text not null,
  deleted boolean
);

create table Actions (
  id integer primary key,
  actionName text not null,
  deleted boolean
);

insert into events (id, eventName, deleted) values (2001, 'Homerun', 0);
insert into events (id, eventName, deleted) values (2002, 'Balk', 0);
insert into events (id, eventName, deleted) values (2003, 'Wildpitch', 0);
insert into events (id, eventName, deleted) values (2004, 'Fourball', 0);
insert into events (id, eventName, deleted) values (2005, 'Strike Out', 0);
insert into events (id, eventName, deleted) values (2006, 'Bunt', 0);
insert into events (id, eventName, deleted) values (2007, 'Deadball', 0);
insert into events (id, eventName, deleted) values (2008, 'Sacrificebunt', 0);
insert into events (id, eventName, deleted) values (2009, 'Notout', 0);

insert into scenes (id, sceneName, deleted) values (0, 'pitch', 0);
insert into scenes (id, sceneName, deleted) values (1, 'pitchzoom', 0);
insert into scenes (id, sceneName, deleted) values (2, 'closeup', 0);
insert into scenes (id, sceneName, deleted) values (3, 'field', 0);
insert into scenes (id, sceneName, deleted) values (4, 'adv', 0);
insert into scenes (id, sceneName, deleted) values (5, 'subtitle', 0);
insert into scenes (id, sceneName, deleted) values (6, 'stand', 0);
insert into scenes (id, sceneName, deleted) values (7, 'dugout', 0);
insert into scenes (id, sceneName, deleted) values (8, 'sketch', 0);
insert into scenes (id, sceneName, deleted) values (9, 'stadium', 0);
insert into scenes (id, sceneName, deleted) values (10, 'pip', 0);

insert into actions (id, actionName, deleted) values (0, 'main', 0);
insert into actions (id, actionName, deleted) values (1, 'drone', 0);
insert into actions (id, actionName, deleted) values (2, 'offside line', 0);
insert into actions (id, actionName, deleted) values (3, 'behind the goal', 0);
insert into actions (id, actionName, deleted) values (4, 'crowd', 0);