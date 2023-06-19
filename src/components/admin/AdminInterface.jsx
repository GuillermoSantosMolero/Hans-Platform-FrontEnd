import { React, useEffect, useState, useCallback } from "react";

import './AdminInterface.css';
import { Session } from '../../context/Session';
import CountDown from '../session/Countdown';

export default function AdminInterface({ username, password, questions, sessions, onSessionCreated }) {
  const [selectedSession, setSelectedSession] = useState({ id: 0, duration: 0, question_id: "", status: "" });
  const [participantList, setParticipantList] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState('');
  const [waitingCountDown, setWaitingCountDown] = useState(false);
  const [targetDateCountdown, setTargetDateCountdown] = useState('2023-04-01T00:00:00Z');
  let timerId;

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions]);

  useEffect(() => {
    if (questions && questions.length > 0 && selectedSession) {
      setSelectedSession((prevSelectedSession) => ({
        ...prevSelectedSession,
        question_id: questions[0].id
      }));
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const getParticipantsBySession = useCallback(() => {
    fetch(
      `/api/session/${selectedSession.id}/allParticipants`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          {
            user: username,
            pass: password
          }
        )
      }
    ).then(res => {
      if (res.status === 200) {
        res.json().then(data => {
          setParticipantList(data);
        });
      } else {
        res.text().then(msg => console.log(msg));
      }
    }).catch(error => {
      console.log(error);
    });
  }, [selectedSession.id, username, password]);

  useEffect(() => {
    if (selectedSession.id !== 0) {
      getParticipantsBySession();
      setCurrentSession(new Session(selectedSession.id, 0, (controlMessage) => {
        if (controlMessage.participant !== 0) {
          if (selectedSession.id === Number(controlMessage.session)) {
            switch (controlMessage.type) {
              case 'join':  
                console.log("case: join");
                getParticipantsBySession();
                break;
              case 'ready':
                console.log("case: ready");
                getParticipantsBySession();
                break;
              default:
                break;
            }
          }
        }
      }));
    }
  }, [selectedSession.id, getParticipantsBySession]);

  const handleSessionChange = (event) => {
    const sessionId = parseInt(event.target.value);
    const session = sessions.find(s => s.id === sessionId);
    session.question_id = selectedSession.question_id;
    session.duration = selectedSession.duration;
    setSelectedSession(session);
  }
  const handleQuestionChange = (event) => {
    setSelectedSession({ ...selectedSession, question_id: event.target.value });
    currentSession.publishControl({ type: 'setup', question_id: event.target.value });
  }

  const startSession = (event) => {
    currentSession.publishControl({ type: 'start', targetDate: Date.now() + selectedSession.duration * 1000 });
    console.log(new Date()+selectedSession.duration + 13)
    setTargetDateCountdown((Date.now() + selectedSession.duration * 1000 +200))
    waitOrCloseSession();
  }
  const waitOrCloseSession = () => {
    if (!waitingCountDown) {
      setWaitingCountDown(true);
      timerId = setTimeout(() => {
        currentSession.publishControl({ type: 'stop' });
        setWaitingCountDown(false);
        setTargetDateCountdown(Date.now())
      }, selectedSession.duration * 1000);
    } else {
      clearTimeout(timerId);
      currentSession.publishControl({ type: 'stop' });
      setWaitingCountDown(false);
      setTargetDateCountdown(Date.now())
    }
  }
  const createSession = (event) => {
    fetch(
      `/api/createSession`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          {
            user: username,
            pass: password
          }
        )
      }
    ).then(res => {
      if (res.status === 200) {
        res.json().then(data => {
          onSessionCreated(data);
        });
      } else {
        res.text().then(msg => console.log(msg));
      }
    }).catch(error => {
      console.log(error);
    });
  }

  const downloadFolder = () => {
    let folderPath = selectedLog
    fetch(`/api/downloadLog/${folderPath}`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = folderPath + ".zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };
  const downloadAllLogs = () => {
    fetch(`/api/downloadAllLogs`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = "AllLogs.zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };

  const fetchlogs = async () => {
    try {
      const response = await fetch('/api/listLogs');
      const data = await response.json();
      setLogs(data.logs);
    } catch (error) {
      console.log(error);
    }
  };
  const handleLogSelect = (event) => {
    const selectedLog = event.target.value;
    setSelectedLog(selectedLog);
  };

  return (
  <div className="admin-interface">
    <div className="left-column">
      <div className="sessionlist">
        <select onChange={handleSessionChange}>
          {sessions && sessions.map(session => (
            <option key={session.id} value={session.id}>Session {session.id}</option>
          ))}
        </select>
        <button onClick={createSession}>New Session</button>
      </div>

      <div className="sessiondetails">
        <label>Id:</label>
        <input type="text" readOnly value={selectedSession && selectedSession.id} />
        <label>Duration:</label>
        <input type="text" value={selectedSession ? selectedSession.duration : ""} onChange={e => setSelectedSession({ ...selectedSession, duration: e.target.value })} />
        <label>Question:</label>
        <select onChange={handleQuestionChange}>
          {questions && questions.map(question => (
            <option key={question.id} value={question.id}>{question.prompt}</option>
          ))}
        </select>
      </div>

      <div className="startsession">
        <CountDown targetDate={targetDateCountdown} />
        <button onClick={startSession}>{waitingCountDown ? "Stop" : "Start"}</button>
      </div>
    </div>

    <div className="center-column">
      <div className="startsession">
        <label>Ready: {participantList ? participantList.filter(participant => participant.status === 'ready').length : 0}/{participantList ? participantList.length : 0}</label>
        <textarea className="inputParticipant" readOnly value={participantList ? participantList.map(p => `${p.username} -> ${p.status}`).join("\n") : "Sin participantes todavía"} />
      </div>

      <div className="loglist">
      <label id="label-log">Lista de logs:</label>
        <select value={selectedLog} onChange={handleLogSelect}>
          <option value="">Seleccionar log</option>
          {logs.map(log => {
            if (log !== "zips") {
              return <option key={log} value={log}>{log}</option>;
            }
            return null;
          })}
        </select>
        <button onClick={fetchlogs}>Obtener logs</button>
        <button onClick={downloadFolder}>Descargar log</button>
        <button onClick={downloadAllLogs}>Descargar todos los logs</button>
      </div>
    </div>

    <div className="right-column">
      {/* Contenido del lateral derecho */}
    </div>
  </div>
  );
}