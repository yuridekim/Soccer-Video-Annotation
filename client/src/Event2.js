//read only
import React, { Component } from "react";
import PropTypes from "prop-types";
import { events, scenes, actions } from "./utils";
import { Header, List, Button, Label, Icon } from "semantic-ui-react";

export default class Event extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {
      index,
      start,
      end,
      labelEvent,
      style,
      onClick,
      onDeleteClick,
      focus
    } = this.props;

    return (
      <List.Item style={{ backgroundColor: index === focus ? "#eee" : "#fff" }}>
        <div
          style={{
            flex: "0 0 auto",
            margin: "5px",
            fontSize: "1.3em",
            ...style
          }}
          onClick={onClick}
        >
          <div style={{ display: "flex", width: "100%" }}>
            <Header size="small" floated="left">
              <Label color="blue" circular>
                {index}
              </Label>
              {labelEvent}
            </Header>
            <div style={{ flex: 1 }} />
            <Button
              icon="remove circle"
              color="red"
              size="medium"
              compact
              onClick={onDeleteClick}
              style={{ marginRight: 0, fontSize: "10px" }}
            />
          </div>
          <div style={{ display: "block" }}>
            Start Frame: {start} <br /> End Frame: {end}
          </div>
        </div>
      </List.Item>
    );
  }
}