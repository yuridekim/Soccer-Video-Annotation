import React, { Component } from "react";
import { Switch, Route, Link } from "react-router-dom";

import "./AdminApp.css";

import {
  Header,
  Segment,
  Table,
  Button,
  Icon,
  Checkbox,
  Input,
  Form
} from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";

const newMapping = {
  events: "newEvent",
  actions: "newAction",
  scenes: "newScene"
};

const renameMapping = {
  events: "eventsRename",
  action: "actionsRename",
  scenes: "scenesRename"
};
class AdminApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      videos: null,
      events: null,
      scenes: null,
      actions: null,
      newEvent: null,
      newScene: null,
      newAction: null,
      editableEvents: false,
      editableScenes: false,
      editableActions: false,
      hiddenEvents: false,
      hiddenScenes: false,
      hiddenActions: false,
      eventsRename: {},
      scenesRename: {},
      actionsRename: {}
    };
  }

  componentDidMount() {
    this.reload();
  }

  async reload() {
    try {
      const r = await fetch("/api/videos/");

      if (!r.ok && r.status === 401) {
        window.location = "/admin/login/";
        return;
      }
    } catch (error) {
      console.log(error, "Database connection failure.");
    }
    try {
      const events = await (await fetch("/api/events/")).json();
      this.setState({
        events: events["message"]
      });
    } catch (error) {
      console.log(error, "Cannot fetch events - Database connection failure.");
    }
    try {
      const scenes = await (await fetch("/api/scenes/")).json();
      this.setState({
        scenes: scenes["message"]
      });
    } catch (error) {
      console.log(error, "Cannot fetch scenes - Database connection failure.");
    }
    try {
      const actions = await (await fetch("/api/actions/")).json();
      this.setState({
        actions: actions["message"]
      });
    } catch (error) {
      console.log(error, "Cannot fetch actions - Database connection failure.");
    }
  }

  convertTimestamp(timestamp) {
    var d = new Date(timestamp);
    var year = d.getFullYear(),
      mo = ("0" + (d.getMonth() + 1)).slice(-2),
      day = ("0" + d.getDate()).slice(-2),
      h = d.getHours(),
      min = ("0" + d.getMinutes()).slice(-2);
    return year + "/" + mo + "/" + day + " " + h + ":" + min;
  }

  async onSubmit(e, mode) {
    e.preventDefault();
    const form = e.target;

    if (mode === "events" || mode === "scenes" || mode === "actions") {
      await (await fetch("/api/" + mode + "/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: this.state[newMapping[mode]]
        })
      })).json();

      form.reset();
      this.reload();
    }
  }
  async toggleDelete(mode, id) {
    if (mode === "events" || mode === "scenes" || mode === "actions") {
      await (await fetch("/api/" + mode + "/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id
        })
      })).json();
    }
    this.reload();
  }

  async rename(id, newName, mode) {
    if (mode === "events" || mode === "scenes" || mode === "actions") {
      await (await fetch("/api/" + mode + "/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          newName
        })
      })).json();
      this.reload();
    }
  }

  async batchRename(mode) {
    if (mode === "events" || mode === "scenes" || mode === "actions") {
      await (await fetch("/api/" + mode + "/rename-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ renames: this.state[renameMapping[mode]] })
      })).json();
      this.setState({
        [renameMapping[mode]]: {}
      });
      this.reload();
    }
  }

  renderEventSceneAction() {
    var modes = ["events", "scenes", "actions"];
    var capitalizedMode = mode => mode.charAt(0).toUpperCase() + mode.slice(1);
    var hideToggle = mode => "hidden" + capitalizedMode(mode);
    var editToggle = mode => "editable" + capitalizedMode(mode);
    var renameList = mode => mode + "Rename";
    var entryName = mode => mode.slice(0, -1) + "Name";

    return modes.map(mode => (
      <Segment>
        <Header className={this.state[hideToggle(mode)] ? "collapsed" : ""}>
          <Icon
            name={this.state[hideToggle(mode)] ? "angle right" : "angle down"}
            onClick={() =>
              this.setState({
                [hideToggle(mode)]: !this.state[hideToggle(mode)]
              })
            }
          ></Icon>
          {capitalizedMode(mode)}{" "}
        </Header>
        <div hidden={this.state[hideToggle(mode)]}>
          <Button
            icon={this.state[editToggle(mode)] ? "lock" : "unlock"}
            content={this.state[editToggle(mode)] ? "Lock" : "Make Edits"}
            onClick={() =>
              this.setState({
                [editToggle(mode)]: !this.state[editToggle(mode)]
              })
            }
          ></Button>
          <Button
            icon="save"
            disabled={Object.keys(this.state[renameList(mode)]).length === 0}
            onClick={() => this.batchRename(mode)}
            content="Apply name changes"
          ></Button>
          <Table celled>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Index</Table.HeaderCell>
                <Table.HeaderCell>Deleted</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(this.state[mode] || []).map(
                ({ id, [entryName(mode)]: name, deleted }, i) => (
                  <Table.Row
                    key={id}
                    style={{ backgroundColor: !!+deleted ? "#ddd" : "#fff" }}
                  >
                    <Table.Cell>
                      <Input
                        transparent={!this.state[editToggle(mode)]}
                        disabled={!this.state[editToggle(mode)]}
                        value={name}
                        onChange={(e, { value }) => {
                          var renameChanges = this.state[renameList(mode)];
                          var entries = this.state[mode];
                          entries[i][entryName(mode)] = value;

                          renameChanges[id] = value;
                          this.setState({
                            [renameList(mode)]: renameChanges,
                            [mode]: entries
                          });
                        }}
                        style={{ opacity: 1 }}
                      ></Input>
                    </Table.Cell>
                    <Table.Cell>{id}</Table.Cell>
                    <Table.Cell>
                      <Checkbox
                        disabled={!this.state[editToggle(mode)]}
                        checked={!!+deleted}
                        onChange={() => this.toggleDelete(mode, id)}
                      ></Checkbox>
                    </Table.Cell>
                  </Table.Row>
                )
              )}
            </Table.Body>
          </Table>
          <Header disabled> Add a new {mode.slice(0, -1)} </Header>
          <Form
            style={{ maxWidth: 600 }}
            onSubmit={e => this.onSubmit(e, mode)}
          >
            <Form.Input
              label={capitalizedMode(mode).slice(0, -1) + " Name:"}
              onChange={(e, { value }) =>
                this.setState({
                  ["new" + capitalizedMode(mode).slice(0, -1)]: value
                })
              }
            ></Form.Input>
            <Button type="submit">Add</Button>
          </Form>
        </div>
      </Segment>
    ));
  }
  render() {
    return (
      <div
        style={{ maxWidth: "1200px", marginLeft: "auto", marginRight: "auto" }}
      >
        <Header disabled>Admin Page</Header>
        <Link to="/">
          <Button>Annotate</Button>
        </Link>
        {this.renderEventSceneAction()}
      </div>
    );
  }
}

export default AdminApp;
