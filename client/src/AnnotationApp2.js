//read only
import React, { Component } from "react";
import "./App.css";
import VideoPlayer from "./VideoPlayer";
import "video.js/dist/video-js.css";
import videojs from "video.js";
import Event from "./Event";
import VideoPreview from "./VideoPreview";
import { frameToSecs, secsToFrame } from "./utils";
import ScenesActions from "./ScenesActions";
import update from "immutability-helper";
import { Hotkeys, GlobalHotKeys } from "react-hotkeys";
import {
  Header,
  Form,
  Button,
  Icon,
  List,
  Grid,
  Dimmer,
  Segment,
  Input,
  Dropdown,
  Divider
} from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";

import uniqueId from "lodash/uniqueId";
import { EventEmitter } from "events";
import { isThisSecond } from "date-fns";
import { callbackify } from "util";
import { timer } from "rxjs";

var URL = window.URL || window.webkitURL;

var videoJsOptions = {
  autoplay: true,
  controls: true,
  preload: "none",
  height: 400
};

const keyMap = {
  UNDO: "ctrl+z",
  REDO: ["ctrl+y", "shift+ctrl+z"],
  SAVE: "ctrl+s"
};

class AnnotationApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentTime: 0,
      videoName: null,
      videoSrc: null,
      json: null,
      jsonName: null,
      history: [],
      historyIndex: 0,
      segmentStart: null,
      segmentEnd: null,
      segmentIndex: null,
      segmentEvent: null,
      videoEndSecs: 0,
      visibleMenu: false,
      visibleScenesActions: false
    };
    this.playSelectedFile = this.playSelectedFile.bind(this);
    this.jumpTo = this.jumpTo.bind(this);
    this.parseJSONInput = this.parseJSONInput.bind(this);
    this.parseJSONBlank = this.parseJSONBlank.bind(this);
    this.playSection = this.playSection.bind(this);
    this.videoPreviewChange = this.videoPreviewChange.bind(this);
    this.export = this.export.bind(this);
    this.setScenesActions = this.setScenesActions.bind(this);
    this.setEvent = this.setEvent.bind(this);
    this.undo = this.undo.bind(this);
    this.redo = this.redo.bind(this);
    this.addEvent = this.addEvent.bind(this);
    this.deleteEvent = this.deleteEvent.bind(this);
    this.deleteEventFromSidebar = this.deleteEventFromSidebar.bind(this);
    this.addToDatabase = this.addToDatabase.bind(this);
    this.fetchFromDatabase = this.fetchFromDatabase.bind(this);
    this.markers = this.markers.bind(this);
    this.id = 0;
    this.events = {};
    this.eventpool = {};
    this.scenes = {}; // complete scenes
    this.scenepool = {}; // undeleted scenes (for options)
    this.actions = {};
    this.actionpool = {}; // undeleted events (for options)
    this.initialize = this.initialize.bind(this);
    this.jsonblank = null;
    this.fps = 0;
    this.pauseFunc = null;
  }

  handlers = {
    UNDO: () => this.undo(),
    REDO: () => this.redo(),
    SAVE: () => this.saveVideoPreview()
  };

  async componentDidMount() {
    var success = true;
    try {
      const eventsR = await (await fetch("/api/events")).json();
      eventsR["message"].forEach(obj => {
        var { id, eventName, deleted } = obj;
        this.events[id] = eventName;

        if (!+deleted) {
          this.eventpool[id] = eventName;
        }
      });
    } catch (error) {
      success = false;
    }

    try {
      const actionsR = await (await fetch("/api/actions")).json();
      actionsR["message"].forEach(obj => {
        var { id, actionName, deleted } = obj;
        this.actions[id] = actionName;

        if (!+deleted) {
          this.actionpool[id] = actionName;
        }
      });
    } catch (error) {
      success = false;
    }
    try {
      const scenesR = await (await fetch("/api/scenes")).json();
      scenesR["message"].forEach(obj => {
        var { id, sceneName, deleted } = obj;
        this.scenes[id] = sceneName;

        if (!+deleted) {
          this.scenepool[id] = sceneName;
        }
      });
    } catch (error) {
      success = false;
    }

    if (!success) {
      const r = window.confirm(
        "There has been an error connecting with the server. Would you like to refresh? If this error persists, please contact the administrator."
      );
      if (r) {
        document.location.reload();
      }
    }
  }

  /**
   * componentDidUpdate - used to set up state given video and json
   * @param {*} prevProps
   * @param {*} prevState
   */
  componentDidUpdate(prevProps, prevState) {
    // if there is no video and json was blank ("" or null)
    // this scenario would occur after changing the video for a previously blank json
    if (!this.state.videoName && this.state.jsonName === "") {
      this.setState({
        json: null,
        history: []
      });
    }

    const fps = this.fps;

    if (
      prevState["segmentStart"] !== this.state.segmentStart ||
      prevState["segmentEnd"] !== this.state.segmentEnd
    ) {
      const player = videojs.getPlayer("videoJS");

      // if player has not loaded metadata yet, wait before running
      if (isNaN(player.duration())) {
        console.log("isnan")
        player.one("loadedmetadata", () => {
          if (fps) {
            this.markers(player, [
              {
                time: frameToSecs(this.state.segmentStart, fps),
                text: "start"
              },
              { time: frameToSecs(this.state.segmentEnd, fps), text: "end" }
            ]);
          }
        });
      } else {
        console.log("notnan")
        if (fps) {
          this.markers(player, [
            { time: frameToSecs(this.state.segmentStart, fps), text: "start" },
            { time: frameToSecs(this.state.segmentEnd, fps), text: "end" }
          ]);
        }
        console.log(this.state)
      }
    }

    if (
      prevState["segmentIndex"] !== this.state.segmentIndex &&
      this.state.segmentIndex !== null
    ) {
      const currentMetadata=this.state.history[
      this.state.history.length - 1 - this.state.historyIndex][0]["annotations"]?this.state.history[
        this.state.history.length - 1 - this.state.historyIndex][0]:this.state.history[
          this.state.history.length - 1 - this.state.historyIndex][0]["database"][this.state.videoName];

      if (this.state.segmentStart === null || this.state.segmentEnd === null) {
        console.log(currentMetadata)
        console.log(this.state.segmentIndex)
        this.setState({
          segmentStart:
            this.state.segmentStart ||
            secsToFrame(currentMetadata["annotations"][this.state.segmentIndex][
              "start"
            ],this.fps)||currentMetadata["annotations"][this.state.segmentIndex][
              "segment"
            ][0],
          segmentEnd:
            this.state.segmentEnd ||
            secsToFrame(currentMetadata["annotations"][this.state.segmentIndex][
              "end"
            ],this.fps)||currentMetadata["annotations"][this.state.segmentIndex][
              "segment"
            ][1]
        });
      } else {
        this.setState({
          segmentStart:
            this.state.segmentStart ||
            secsToFrame(currentMetadata["annotations"][this.state.segmentIndex][
              "start"
            ],this.fps)||currentMetadata["annotations"][this.state.segmentIndex][
              "segment"
            ][0],
          segmentEnd:
            this.state.segmentEnd ||
            secsToFrame(currentMetadata["annotations"][this.state.segmentIndex][
              "end"
            ],this.fps)||currentMetadata["annotations"][this.state.segmentIndex][
              "segment"
            ][1]
        });
      }
    }

    if (
      prevState.segmentIndex !== this.state.segmentIndex &&
      (this.state.segmentIndex > 0 || this.state.segmentIndex === 0)
    ) {
      const player = videojs("videoJS");
      const duration = videojs("videoJS").duration();
      if (isNaN(duration)) {
        player.one("loadedmetadata", () => {
          this.playSection();
          // document.getElementById("play_section").click();
        });
      } else {
        this.playSection();
        // document.getElementById("play_section").click();
      }
    }
  }

  markers(player, marklist) {
    var playheadWell = document.getElementsByClassName(
      "vjs-progress-holder vjs-slider"
    )[0];

    var elements = playheadWell.getElementsByClassName("vjs-marker");
    while (elements[0]) {
      playheadWell.removeChild(elements[0]);
    }

    marklist.forEach((marker, i) => {
      var elem = document.createElement("div");
      elem.className = "vjs-marker";
      elem.id = "mk" + i;
      elem.style.left = (marker.time / player.duration()) * 100 + "%";
      playheadWell.appendChild(elem);
    });
  }

  async fetchFromDatabase(videoName) {
    try {
      await (await fetch("/api/start/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          videoName
        })
      }))
        .json()
        .then(async message => {
          // TODO: maybe send meaningful message on error?'
          const { id, currentJson } = message["message"][0];
          this.id = id;
          console.log("Restoring", id);
          console.log(this.state.videoSrc);
          if (currentJson) {
            const r = window.confirm(
              "You have previously saved work. Restore?"
            );
            if (r) {
              const newState = JSON.parse(currentJson);
              this.setState(newState);
              this.fps =
                newState["json"]["database"][newState["videoName"]]["fps"];
            }
          }
        });
    } catch (err) {
      console.log(err);
    }
  }

  async addToDatabase() {
    const videoName = this.state.videoName;
    const jsonName = this.state.jsonName;
    const id = this.id;

    const currentJson = update(this.state, { $unset: ["videoSrc"] });
    try {
      const message = await (await fetch("/api/save/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: id,
          videoName,
          jsonName,
          currentJson
        })
      })).json();
      const newId = message["message"];
      if (!id) {
        this.id = newId;
      }
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Initialize state given video or json /user/ inputs.
   *
   * If video or json changes: //TODO: is this ever not true in this function?
   *  Check if json and video match
   *    If no, send alert
   *    If yes, proceed with resetting state
   *
   */
  initialize(
    videoName = this.state.videoName,
    videoSrc = this.state.videoSrc,
    segmentIndex = json["annotations"]?json["annotations"].length:null,//segmentIndex = this.state.segmentIndex,
    json = this.state.json,
    jsonName = this.state.jsonName
  ) {
    console.log("here1")
      if (videoName && json) {
        // if video and json match
        this.setState({
          visibleMenu: true,
          history: [[json, segmentIndex]],//history: [[json["database"][videoName], segmentIndex]],
          historyIndex: 0
          });
          this.fps = 30;//
         /*삭제else {
          // if not match and jsonName is blank, this means new video that needs new blank
          alert(
            "The video and json do not match. Please wait to edit from scratch or upload the correct json file. "
          );
          segmentIndex = null;
          this.setState({
            videoEndSecs: null,
            // segmentIndex: null,
            history: [],
            json: json
          });

          // if received matching jsonblank
          if (
            this.jsonblank &&
            Object.keys(this.jsonblank["database"]).indexOf(videoName) >= 0
          ) {
            this.initialize(
              this.state.videoName,
              this.state.videoSrc,
              this.state.segmentIndex,
              this.jsonblank,
              "generated"
            );
          }
        }*/
      }
      console.log(this.state.history)
    

    this.setState({
      videoName,
      videoSrc,
      segmentIndex,
      json,
      jsonName
    });
  }

  // on video upload
  playSelectedFile(event) {
    var file = event.target.files[0];
    const player = videojs.getPlayer("videoJS");

    if (!file) {
      this.initialize(null, null, null);
      this.setState({
        videoEndSecs: null
      });
      player.reset();
      return;
    }

    if (player.canPlayType(file.type) === "") {
      alert(
        "Cannot play video with type " +
          file.type +
          ", please select a different video or use a different browser."
      );
      return;
    }

    var fileURL = URL.createObjectURL(file);
    player.src({
      src: fileURL,
      type: file.type
    });

    this.fetchFromDatabase(file.name.substring(0, file.name.lastIndexOf(".")));
    this.initialize(
      file.name.substring(0, file.name.lastIndexOf(".")),
      {
        src: fileURL,
        type: file.type
      },
      null
    );

    player.on("loadedmetadata", () => {
      this.setState({
        videoEndSecs: player.duration()
      });
    });

    player.on("timeupdate", () => {
      this.setState({
        currentTime: player.currentTime()
      });
    });
  }

  parseJSONInput(event) {
    if (!event.target.files[0]) {
      this.initialize(
        this.state.videoName,
        this.state.videoSrc,
        this.state.segmentIndex,
        null,
        null
      );
      return;
    }

    var reader = new FileReader();
    reader.onload = event => {
      var json = JSON.parse(event.target.result);
      // TODO: add more to ensure correct formatting (ex: annotations)
      /*if (!("database" in json)) {
        alert("Wrong format, please upload new json.");
        var jsonUpload = document.getElementById("input_json");
        jsonUpload.click();
        return;
      }*/
      this.initialize(
        this.state.videoName,
        this.state.videoSrc,
        this.state.segmentIndex,
        json
      );
    };

    reader.readAsText(event.target.files[0]);

    this.setState({
      jsonName: event.target.files[0].name.substring(
        0,
        event.target.files[0].name.lastIndexOf(".")
      )
    });
  }

  /**
   * Called by hidden input input_json_blank, which index.html puts generated blank files into.
   */
  parseJSONBlank(value) {
    // when json and video don't match or when there's no uploaded json
    this.jsonblank = JSON.parse(value);
    if (
      !this.state.json ||
      Object.keys(this.state.json["database"]).indexOf(this.state.videoName) < 0
    ) {
      this.initialize(
        this.state.videoName,
        this.state.videoSrc,
        this.state.segmentIndex,
        this.jsonblank,
        "generated"
      );
    }
  }

  /**
   * playSection - plays video from this.state.segmentStart to this.state.segmentEnd if the latter is bigger than the former
   */
  async playSection(
    startInput = this.state.start,
    endInput = this.state.end
  ) {
    var fps = this.fps;

    var myPlayer = videojs.getPlayer("videoJS");
    
    console.log(videojs)
    console.log(myPlayer)
    
    var startInput = this.state.segmentStart;
    var endInput = this.state.segmentEnd;
    var start = frameToSecs(startInput, fps) || 0;
    var end = frameToSecs(endInput, fps) || this.state.videoEndSecs;//duration 수정
    console.log(start, end);
    if (end >= start) {
      if (this.pauseFunc) {
        myPlayer.off("timeupdate", this.pauseFunc);
        this.pauseFunc = null;
      }
      myPlayer.currentTime(start);
      var pauseFunc = function(e) {
        if (myPlayer.currentTime() >= end) {
          myPlayer.pause();
          myPlayer.off("timeupdate", pauseFunc);
        }
      };
      myPlayer.on("timeupdate", pauseFunc);
      this.pauseFunc = pauseFunc;
      myPlayer.play();
    } else {
      alert("end time" + end + "should be bigger than start time" + start);
      return;
    }
  }

  /**
   * jumpTo - plays video from this.state.segmentStart to this.state.segmentEnd if the latter is bigger than the former
   */
  jumpTo() {
    var myPlayer = videojs.getPlayer("videoJS");
    var startInput = parseInt(document.getElementById("start").value);
    var endInput = parseInt(document.getElementById("end").value);
    var start =
      frameToSecs(
        startInput,
        this.fps
      ) || 0;
    var end =
      frameToSecs(
        endInput,
        this.fps
      ) || myPlayer.duration();

    myPlayer.currentTime(start);

    if (end > start) {
      myPlayer.on("timeupdate", function(e) {
        if (myPlayer.currentTime() >= end) {
          myPlayer.pause();
          myPlayer.off("timeupdate");
        }
      });
    } else {
      alert("Please set end frame to be bigger than start frame.");
    }

    myPlayer.play();
  }

  /**
   * saveMetadata - sort annotations in metadata and appropriately maintain history (last 20)
   * @param {*} metadata - metadata to be sorted and added onto history
   * @param {*} segmentIndex - segmentIndex is the current index of the event we want after save (for sorting in add event and time change)
   * @param {*} segmentStart - segmentStart is the start frame for the event we want after save
   * @param {*} segmentEnd - segmentEnd is the end frame for the event we want after save
   *
   * segmentIndex, segmentStart, segmentEnd used to move focus to a different event
   *  for addEvent - this is so that when addEvent is clicked we see the new event ready to be edited
   *  for deleteEvent - this is so that when we delete an event we go back to empty slate and select a new event for editing
   */
  async saveMetadata(
    metadata,
    segmentIndex = this.state.segmentIndex,
    segmentStart = this.state.segmentStart,
    segmentEnd = this.state.segmentEnd
  ) {
    // sorting metadata by time
    metadata = update(metadata, {
      annotations: {
        $apply: arr =>
          arr.sort(
            (a, b) =>
            secsToFrame(a["segment"][0]) - secsToFrame(b["segment"][0],this.fps) ||
            secsToFrame(a["segment"][1]) - secsToFrame(b["segment"][1],this.fps)
          )
      }
    });

    // getting new index after sort
    var newIndex =
      segmentIndex > 0 || segmentIndex === 0
        ? metadata["annotations"].reduce((acc, curr, index) => {
            if (curr["segmentIndex"] === segmentIndex) {
              acc.push(index);
            }
            return acc;
          }, [])[0]
        : null;

    // set segmentIndex so that it matches index in array
    metadata = update(metadata, {
      annotations: {
        $apply: arr => {
          return arr.map((event, index) => {
            return update(event, { segmentIndex: { $set: index } });
          });
        }
      }
    });

    // push this new metadata to history
    var history = update(
      this.state.history.slice(
        0,
        this.state.history.length - this.state.historyIndex
      ),
      { $push: [[metadata, newIndex]] }
    );

    // only keep the last 20 saved metadata
    history = history.slice(Math.max(history.length - 20, 0));

    await this.setState({
      history: history,
      historyIndex: 0,
      segmentIndex: newIndex,
      segmentStart: segmentStart,
      segmentEnd: segmentEnd
    });
    this.addToDatabase();
  }

  /**
   * addEvent
   *
   * adds new event at the end of event list
   * default start frame is 1 more than end frame of last event in list
   * default end frame is end of video
   * this navigates to new frame - if old frame has no scenes or actions, alert
   */
  addEvent() {
    const willProceed = this.alertEventSceneAction("add");
    if (!willProceed) {
      return;
    }

    const currentMetadata=this.state.history[
      this.state.history.length - 1 - this.state.historyIndex][0]["annotations"]?this.state.history[
        this.state.history.length - 1 - this.state.historyIndex][0]:this.state.history[
          this.state.history.length - 1 - this.state.historyIndex][0]["database"][this.state.videoName];
    const newIndex = currentMetadata["annotations"].length;

    const videoEnd = secsToFrame(
      this.state.videoEndSecs,
      this.fps
    );
    var segmentStart=0;

    if(newIndex >= 1){
      var a = currentMetadata["annotations"][newIndex - 1]["end"].split(':')
      var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]); 
      segmentStart=Math.min(
        secsToFrame(seconds,this.fps) + 1,
          videoEnd)
    }

    var metadata = update(currentMetadata, {
      annotations: {
        $push: [
          {
            segmentIndex: newIndex,
            action: null,
            labelEventIdx: null,
            type:null,
            segment: [segmentStart, videoEnd],
            current_category_1: null,
            labelSceneIndex: [],
            //삭제numberOfScenes: 0,
            current_category_2: null,
            labelActionIndex: [],
            next_category1: "0",
            next_category2: "0",
            start:null,
            end:null,
            video_id:null,
            video_url:null
            //삭제numberOfActions: []
          }
        ]
      }
    });

    this.saveMetadata(metadata, newIndex, segmentStart, videoEnd);
    this.setState({
      visibleScenesActions: true
    });
  }

  /**
   * Handler for deleting events from sidebar, this allows for deleting events not currently selected
   */
  deleteEventFromSidebar(segmentIndex) {
    if (segmentIndex === this.state.segmentIndex) {
      console.log("not supposed to go here more than one");
      this.deleteEvent(segmentIndex);
    } else {
      var metadata = update(
        this.state.history[
          this.state.history.length - 1 - this.state.historyIndex
        ][0],
        {
          annotations: {
            $splice: [[segmentIndex, 1]]
          }
        }
      );

      this.saveMetadata(
        metadata,
        this.state.segmentIndex,
        this.state.segmentStart,
        this.state.segmentEnd
      );
    }
  }

  /**
   * Delete segmentIndex (= this.state.segmentIndex).
   *
   * Algo:
   *  Move focus to event before
   *  Call deleteEventFromSidebar (as if deleted in sidebar to this segmentIndex)
   * @param {*} segmentIndex
   */
  async deleteEvent(segmentIndex) {
    var metadata = update(
      this.state.history[
        this.state.history.length - 1 - this.state.historyIndex
      ][0],
      {
        annotations: {
          $splice: [[segmentIndex, 1]]
        }
      }
    );

    const numberOfEvents = this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ][0]["annotations"].length;

    await this.setState({
      segmentIndex: numberOfEvents > 1 ? Math.max(0, segmentIndex - 1) : null
    });

    this.deleteEventFromSidebar(segmentIndex);
  }

  undo() {
    var historyIndex = this.state.historyIndex;
    historyIndex = Math.min(this.state.history.length - 1, historyIndex + 1);
    this.setState({
      historyIndex: historyIndex,
      segmentIndex: this.state.history[
        this.state.history.length - 1 - historyIndex
      ][1]
    });
  }

  redo() {
    var historyIndex = this.state.historyIndex;
    historyIndex = Math.max(0, historyIndex - 1);
    this.setState({
      historyIndex: historyIndex,
      segmentIndex: this.state.history[
        this.state.history.length - 1 - historyIndex
      ][1]
    });
  }

  saveVideoPreview() {
    if (this.state.segmentEnd < this.state.segmentStart) {
      alert("End frame cannot be smaller than start frame");
      return;
    }

    const currentMetadata=this.state.history[
      this.state.history.length - 1 - this.state.historyIndex][0]["annotations"]?this.state.history[
        this.state.history.length - 1 - this.state.historyIndex][0]:this.state.history[
          this.state.history.length - 1 - this.state.historyIndex][0]["database"][this.state.videoName];

    // if nothing changed don't do anything
    if (
      secsToFrame(currentMetadata["annotations"][this.state.segmentIndex]["start"],this.fps) ===
        this.state.segmentStart &&
        secsToFrame(currentMetadata["annotations"][this.state.segmentIndex]["end"],this.fps) ===
        this.state.segmentEnd
    ) {
      return;
    }

    var metadata = update(currentMetadata, {
      annotations: {
        [this.state.segmentIndex]: {
          segment: {
            $set: [this.state.segmentStart, this.state.segmentEnd]
          }
        }
      }
    });
    this.saveMetadata(
      metadata,
      this.state.segmentIndex,
      this.state.segmentStart,
      this.state.segmentEnd
    );
  }

  export() {
    const willProceed = this.alertEventSceneAction("export");
    if (!willProceed) {
      return;
    }

    var metadata = this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ][0];

    //var dup_metadata=Object.assign({},metadata)
    var dup_metadata=JSON.parse(JSON.stringify(metadata))

    dup_metadata['annotations'].forEach(function(v){delete v.labelActionIndex})
    dup_metadata['annotations'].forEach(function(v){delete v.labelSceneIndex})
    dup_metadata['annotations'].forEach(function(v){delete v.segmentIndex})
    dup_metadata['annotations'].forEach(function(v){delete v.labelEventIdx})
    dup_metadata['annotations'].forEach(function(v){delete v.labelSceneIndex})
    dup_metadata['annotations'].forEach(function(v){delete v.segment})

    delete dup_metadata.duration
    delete dup_metadata.fps

    var json = this.state.json;
    json = metadata;//json["database"][videoName]=metadata

    var dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(dup_metadata, null, 2));

    var dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute(
      "download",
      this.state.jsonName + "_changed.json"
    );
    dlAnchorElem.click();
  }

  setScenesActions(items, mode) {
    var metadata;
    if (mode === "scenes") {
      metadata = update(
        this.state.history[
          this.state.history.length - 1 - this.state.historyIndex
        ][0],
        {
          annotations: {
            [this.state.segmentIndex]: {
              labelSceneIndex: { $set: items }
            }
          }
        }
      );
      metadata = update(metadata, {
        annotations: {
          [this.state.segmentIndex]: {
            type: {$set: this.scenes[items[1]] },
            current_category_1: { $set: this.scenes[items[0]] }
          }
        }
      });
      if(this.state.segmentIndex != 0 ){
        metadata = update(metadata, {
          annotations: {
            [this.state.segmentIndex-1]: {
              next_category1: { $set: this.scenes[items[0]] }
            }
          }
        });
      }
    } else if (mode === "actions") {

      metadata = update(
        this.state.history[
          this.state.history.length - 1 - this.state.historyIndex
        ][0],
        {
          annotations: {
            [this.state.segmentIndex]: {
              labelActionIndex: { $set: items }
            }
          }
        }
      );
      metadata = update(metadata, {
        annotations: {
          [this.state.segmentIndex]: {
            current_category_2: { $set: this.actions[items[0]] }
          }
        }
      });
      //밑에 원래 삭제
      metadata = update(metadata, {
        annotations: {
          [this.state.segmentIndex]: {
            start:{$set: new Date(frameToSecs(this.state.segmentStart, this.fps) * 1000).toISOString().substr(11, 8)},
            end:{$set: new Date(frameToSecs(this.state.segmentEnd, this.fps) * 1000).toISOString().substr(11, 8)},
            video_id: { $set: this.state.videoName+".mp4"},
            video_url: { $set: this.state.videoName}
          }
        }
      });
      if(this.state.segmentIndex != 0 ){
        metadata = update(metadata, {
          annotations: {
            [this.state.segmentIndex-1]: {
              next_category2: { $set: this.actions[items[0]] }
            }
          }
        });
      }
      /*삭제metadata = update(metadata, {
        annotations: {
          [this.state.segmentIndex]: {
            numberOfActions: { $set: items.length }
          }
        }
      });*/
    }
    this.saveMetadata(metadata);
  }

  videoPreviewChange(frame, name) {
    if (name === "start") {
      this.setState({ segmentStart: isNaN(frame) ? 0 : frame });
    } else if (name === "end") {
      this.setState({ segmentEnd: isNaN(frame) ? 0 : frame });
    }
  }

  setEvent(value) {
    var metadata = update(
      this.state.history[
        this.state.history.length - 1 - this.state.historyIndex
      ][0],
      {
        annotations: {
          [this.state.segmentIndex]: {
            action: { $set: this.events[value] }
          }
        }
      }
    );
    metadata = update(metadata, {
      annotations: {
        [this.state.segmentIndex]: { labelEventIdx: { $set: value } }
      }
    });
    this.saveMetadata(metadata);
  }

  alertEventSceneAction(mode) {
    var alertMessage;
    if (mode === "export") {
      alertMessage =
        "You have unsaved changes. Click OK to export the last saved version. Click cancel to cancel export.";
    } else if (mode === "click") {
      alertMessage =
        "You have unsaved changes. Navigating to another event will discard these unsaved changes. Continue?";
    } else if (mode === "add") {
      alertMessage =
        "You have unsaved changes. Adding an event will discard these unsaved changes. Continue?";
    } else {
      return; // Not called correctly
    }

    const currentMetadata=this.state.history[
      this.state.history.length - 1 - this.state.historyIndex][0]["annotations"]?this.state.history[
        this.state.history.length - 1 - this.state.historyIndex][0]:this.state.history[
          this.state.history.length - 1 - this.state.historyIndex][0]["database"][this.state.videoName];

    if (this.state.segmentIndex > 0 || this.state.segmentIndex === 0) {
      const saved =currentMetadata["annotations"][this.state.segmentIndex][
        "segment"
      ]?
        currentMetadata["annotations"][this.state.segmentIndex][
          "segment"
        ][0] === this.state.segmentStart &&
        currentMetadata["annotations"][this.state.segmentIndex][
          "segment"
        ][1] === this.state.segmentEnd:true;
      if (!saved) {
        const r = window.confirm(alertMessage);
        if (!r) {
          return false;
        }
      }
    }

    const newIndex = currentMetadata["annotations"].length;//수정

    const editReady =
      this.state.segmentIndex > 0 || this.state.segmentIndex === 0;
    const thereAreEvents = newIndex > 0;

    const eventType =
      editReady && thereAreEvents
        ? currentMetadata["annotations"][this.state.segmentIndex][
            "labelEventIdx"
          ] || ""
        : //TODO: labelEventIndex?
          null;
    const sceneItems =
      editReady && thereAreEvents
        ? currentMetadata["annotations"][this.state.segmentIndex][
            "labelSceneIndex"
          ]
        : [];
    const actionItems =
      editReady && thereAreEvents
        ? currentMetadata["annotations"][this.state.segmentIndex][
            "labelActionIndex"
          ]
        : [];

    /**
     * If event type selected is not in current undeleted events, send an alert for user to input event type.
     * If the current event's scenes or actions are empty, send an alert.
     */
    const eventWarning =false
      //editReady && thereAreEvents && !(eventType in this.eventpool);
    const sceneWarning =false
      //sceneItems.length === 0 && this.state.segmentIndex !== null;
    const actionWarning =false
      //actionItems.length === 0 && this.state.segmentIndex !== null;

    const message =
      (eventWarning ? " You have not selected a valid event type." : "") +
      (sceneWarning ? " You have not put any scenes." : "") +
      (actionWarning ? " You have not put any actions." : "");

    if (eventWarning || sceneWarning || actionWarning) {
      alert("[WARNING] Event " + this.state.segmentIndex + ":" + message);
    }
    return true;
  }

  renderEvents() {
    const annotData=this.state.history.length > 0? "annotations" in this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ][0]?this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ][0]["annotations"]:this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ][0]["database"][this.state.videoName]["annotations"]: null
    // TODO: Stop frequent renderEvents?
    if(annotData==null){
      return null
    }
    return annotData.map((prop, i) => (
            <Event
              id={"event_" + i}
              key={i}
              //segment={prop.segment}
              start={prop.start}
              end={prop.end}
              labelEvent={prop.action?prop.action:this.events[prop.labelEventIdx]}//labelEvent={this.events[prop.labelEventIdx]}
              index={i}
              onClick={async () => {
                if (prop["segmentIndex"]?prop["segmentIndex"]:i !== this.state.segmentIndex) {
                  const willProceed = this.alertEventSceneAction("click");
                  if (!willProceed) {
                    return;
                  }
                }
                var start_prop=prop["start"]
                var end_prop=prop["end"]
                if(prop["start"].split(':')){
                  var a = prop["start"].split(':')
                  var b = prop["end"].split(':')
                  var seconds_start = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]); 
                  var seconds_end = (+b[0]) * 60 * 60 + (+b[1]) * 60 + (+b[2]); 
                }
                await this.setState({
                  segmentStart: secsToFrame(seconds_start,30),//segmentStart: secsToFrame(prop["start"],this.fps)
                  segmentEnd: secsToFrame(seconds_end,30),
                  segmentIndex: prop["segmentIndex"]?prop["segmentIndex"]:i,
                  visibleScenesActions: true
                });
                this.playSection(secsToFrame(seconds_start,this.fps), secsToFrame(seconds_end,this.fps));
              }}
              onDeleteClick={e => {
                this.deleteEventFromSidebar(prop["segmentIndex"]?prop["segmentIndex"]:i);
                e.stopPropagation();
              }}
              focus={this.state.segmentIndex}
            />
          ));
  }

  render() {
    const ready = this.state.json && this.state.videoName;
    const editReady =
      this.state.segmentIndex > 0 || this.state.segmentIndex === 0;
    const active = !ready || !editReady;
    const content = !ready ? (
      <div>
        <Header as="h2" inverted>
          Please complete uploading the video. If you would like to resume
          editing from a JSON, please also upload the JSON file.
        </Header>
      </div>
    ) : !editReady ? (
      <div>
        <Header as="h2" inverted>
          Click on an event on the sidebar to start editing.
        </Header>
      </div>
    ) : (
      <div>
        <Header as="h2" inverted>
          Something went wrong.
        </Header>
      </div>
    );

    const currentMetadata = this.state.history[
      this.state.history.length - 1 - this.state.historyIndex
    ]
      ? this.state.history[
          this.state.history.length - 1 - this.state.historyIndex
        ][0]
      : null;

    const thereAreEvents = true/*currentMetadata
      ? currentMetadata["annotations"].length > 0
      : false;*/

    return (
      <div style={{ display: "flex", height: "100vh", flexDirection: "row" }}>
        <GlobalHotKeys keyMap={keyMap} handlers={this.handlers} />
        <div
          style={{
            display: this.state.visibleMenu ? "flex" : "none",
            flexDirection: "column",
            padding: "1em",
            borderRight: "1px solid #ccc",
            height: "100%",
            flex: 3,
            maxWidth: 300,
            backgroundColor: "#fff",
            minWidth: "max-content",
            maxWidth: "300px"
          }}
        >
          <Header size="large" style={{ flex: "0 0 auto" }}>
            Events
            <Icon
              size="small"
              name="angle left"
              style={{ float: "right", marginRight: 0 }}
              onClick={() => this.setState({ visibleMenu: false })}
            />
          </Header>
          <Button
            fluid
            positive
            icon
            labelPosition="left"
            onClick={this.addEvent}
            disabled={Object.keys(this.state.history).length === 0} //only have history with uploaded json and vid matching
          >
            {" "}
            <Icon name="add" size="small" />
            Add Event
          </Button>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <List divided selection>
              {this.renderEvents()}
            </List>
          </div>
          <Button
            icon
            labelPosition="left"
            onClick={this.export}
            disabled={Object.keys(this.state.history).length === 0}
          >
            <Icon name="download" />
            Export
          </Button>
        </div>
        <div
          style={{
            height: "auto",
            padding: "1em 0.5em",
            borderRight: "1px solid #ccc",
            display: this.state.visibleMenu ? "none" : "flex",
            flexDirection: "column",
            maxWidth: "50px",
            alignItems: "center"
          }}
        >
          <Icon
            size="large"
            name="bars"
            onClick={() => this.setState({ visibleMenu: true })}
            style={{ marginRight: 0, marginBottom: "10px" }}
          />
          <Button
            size="small"
            icon
            positive
            onClick={this.addEvent}
            disabled={Object.keys(this.state.history).length === 0}
            style={{ marginRight: 0, marginBottom: "10px" }}
          >
            <Icon name="add" />
          </Button>
          <div style={{ display: "flex", flex: 1 }}></div>
          <Button
            size="small"
            icon
            onClick={this.export}
            disabled={Object.keys(this.state.history).length === 0}
            style={{ marginRight: 0 }}
          >
            <Icon name="download" />
          </Button>
        </div>
        <div
          style={{
            display:
              editReady && thereAreEvents && this.state.visibleScenesActions
                ? "flex"
                : "none",
            flex: 8,
            flexDirection: "column",
            height: "100%",
            borderLeft: "1px solid #ddd",
            borderRight: "1px solid #ddd",
            minWidth: "max-content"
          }}
        >
          <div
            style={{
              display: "flex",
              height: "38px",
              width: "100%",
              borderTop: "1px #222426",
              alignItems: "center"
            }}
          >
            <Header
              as="h4"
              floated="left"
              size="large"
              style={{ padding: "5px 10px", margin: 0 }}
            >
              Event {this.state.segmentIndex}
            </Header>
            <div style={{ flex: 1 }} />
            <Button
              negative
              size="small"
              icon
              labelPosition="left"
              onClick={() => this.deleteEvent(this.state.segmentIndex)}
              disabled={Object.keys(this.state.history).length === 0} //only have history with uploaded json and vid matching
              style={{ float: "right", margin: "5px 10px" }}
            >
              {" "}
              <Icon name="remove circle" size="small" />
              Delete Event
            </Button>
            <Icon
              size="big"
              name="angle left"
              style={{ float: "right", marginRight: 0 }}
              onClick={() => this.setState({ visibleScenesActions: false })}
            />
          </div>
          <ScenesActions
            key={this.state.segmentIndex + "scenes"}
            index={this.state.segmentIndex}
            mode="scenes"
            items={
              editReady && thereAreEvents
                ? [currentMetadata["annotations"][this.state.segmentIndex]]
                : []
            }
            style={{
              flex: 1,
              padding: "5px",
              borderBottom: "1px solid #ddd",
              borderTop: "1px solid #ddd"
            }}
            source={this.scenepool}
            sourceall={this.scenes}
            onChange={this.setScenesActions}
          />
          <ScenesActions
            key={this.state.segmentIndex + "actions"}
            index={this.state.segmentIndex}
            mode="actions"
            items={
              editReady && thereAreEvents
                ? [currentMetadata["annotations"][this.state.segmentIndex]]
                : []
            }
            source={this.actionpool}
            sourceall={this.actions}
            style={{ flex: 1, padding: "5px" }}
            onChange={this.setScenesActions}
          />
        </div>
        <div
          style={{
            display: "flex",
            flex: "24 1 0",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "#ddd",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div
            style={{
              display: "flex",
              flex: "0 0 auto",
              width: "100%",
              flexDirection: "column",
              alignItems: "center",
              paddingBottom: "10px",
              height: "454px"
            }}
          >
            <div
              style={{ display: "flex", flexDisplay: "row", padding: "5px" }}
            >
              <Button
                primary
                onClick={() => document.getElementById("input_video").click()}
              >
                Upload video
              </Button>
              <input
                style={{ display: "none" }}
                id="input_video"
                type="file"
                accept="video/*"
                onChange={e => {
                  this.playSelectedFile(e);
                }}
              />
              <Button
                color="grey"
                onClick={() => document.getElementById("input_json").click()}
              >
                Upload JSON
              </Button>
              <input
                style={{ display: "none" }}
                id="input_json"
                type="file"
                accept=".json, application/json"
                onChange={e => {
                  this.parseJSONInput(e);
                }}
              />
              <input
                style={{ display: "none" }}
                id="input_json_blank"
                type="text"
                onChange={e => {
                  this.parseJSONBlank(e.target.value);
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center"
              }}
            >
              <VideoPlayer id="videoJS" {...videoJsOptions} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#fff",
                  padding: "5px",
                  maxWidth: 360
                }}
              >
                <h4 style={{ margin: "5px" }}>
                  Video Name: {this.state.videoName}
                </h4>
                <h4 style={{ margin: "5px" }}>
                  JSON Name: {this.state.jsonName}
                </h4>
                <h4 style={{ margin: "5px" }}>
                  Current Frame:
                  {currentMetadata
                    ? secsToFrame(
                        this.state.currentTime,
                        this.fps
                      )
                    : 0}
                </h4>
                <Button
                  primary
                  compact
                  disabled={!editReady}
                  onClick={() => {
                    if (!currentMetadata) return;
                    this.setState({
                      segmentStart: secsToFrame(
                        this.state.currentTime,
                        currentMetadata["fps"]
                      )
                    });
                  }}
                  style={{ marginBottom: "5px" }}
                >
                  Send to start
                </Button>
                <Button
                  compact
                  color="grey"
                  disabled={!editReady}
                  onClick={() => {
                    if (!currentMetadata) return;
                    this.setState({
                      segmentEnd: secsToFrame(
                        this.state.currentTime,
                        currentMetadata["fps"]
                      )
                    });
                  }}
                >
                  Send to end
                </Button>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              backgroundColor: "#fff",
              flex: 1
            }}
          >
            <Dimmer.Dimmable
              blurring
              dimmed={active}
              style={{ height: "100%" }}
            >
              <Dimmer active={active} content={content} />
              <Divider style={{ margin: 0 }} />
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  overflowY: "auto",
                  overflowX: "auto",
                  height: "calc(100vh - 455px)",
                  alignContent: "flex-start"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    width: "100%",
                    paddingBottom: "5px",
                    height: "100%"
                  }}
                >
                  <div style={{ display: "block", padding: "5px 10px" }}>
                    <b>Type: </b>
                    <Dropdown
                      key={
                        this.state.segmentIndex + " " + this.state.historyIndex
                      }
                      search
                      selection
                      onChange={(e, { value }) => this.setEvent(value)}
                      options={Object.keys(this.eventpool).map(id =>
                        Object({
                          key: id,
                          text: this.eventpool[id],
                          value: id
                        })
                      )}
                      defaultValue={
                        editReady && thereAreEvents
                          ? currentMetadata["annotations"][
                              this.state.segmentIndex
                            ]["labelEventIdx"] || ""
                          : //TODO: labelEventIndex?
                            null
                      }
                      placeholder="Select event type or search"
                    ></Dropdown>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      flexDirection: "row",
                      height: "100%",
                      alignItems: "flex-start",
                      justifyContent: "space-around"
                    }}
                  >
                    <VideoPreview
                      key={
                        this.state.videoName + this.state.segmentIndex + "start"
                      }
                      name="start"
                      frame={editReady ? this.state.segmentStart : 0}
                      onChange={this.videoPreviewChange}
                      fps={currentMetadata ? currentMetadata["fps"] : null}
                      src={this.state.videoSrc}
                      end={this.state.videoEndSecs}
                    />
                    <VideoPreview
                      key={
                        this.state.videoName + this.state.segmentIndex + "end"
                      }
                      name="end"
                      frame={
                        editReady
                          ? this.state.segmentEnd
                          : secsToFrame(this.state.videoEndSecs, this.fps) || 0
                      }
                      onChange={this.videoPreviewChange}
                      fps={this.fps}
                      src={this.state.videoSrc}
                      end={this.state.videoEndSecs}
                    />
                    <div
                      style={{
                        display: "flex",
                        flex: 0,
                        flexDirection: "column"
                      }}
                    >
                      <Button
                        id="play_section"
                        primary
                        content="Play section"
                        icon="play"
                        labelPosition="left"
                        onClick={() => this.playSection()}
                        style={{ marginTop: "5px" }}
                      />
                      <Button
                        color="grey"
                        icon
                        labelPosition="left"
                        onClick={e => {
                          this.saveVideoPreview();
                        }}
                        style={{ marginTop: "5px" }}
                      >
                        <Icon name="save" />
                        Apply frames
                      </Button>
                      <Button
                        negative
                        icon
                        labelPosition="left"
                        onClick={() =>
                          this.deleteEvent(this.state.segmentIndex)
                        }
                        disabled={Object.keys(this.state.history).length === 0} //only have history with uploaded json and vid matching
                        style={{ marginTop: "5px" }}
                      >
                        <Icon name="remove circle" size="small" />
                        Delete Event
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Dimmer.Dimmable>
          </div>
        </div>
      </div>
    );
  }
}

export default AnnotationApp;


