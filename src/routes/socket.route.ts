import {Server, Socket} from 'socket.io';
import { questions } from '../utils/questions';
import { evaluateUserCode } from './codeExecutor';
const users: Map<string, any> = new Map();
const waitingQueue: string[] = [];
const competitionRooms: Map<string, any> = new Map();


export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Socket connection established',socket.id);
  });

io.on('connection', (socket:Socket) => {
    console.log(`User connected: ${socket.id}`);
    
    users.set(socket.id, {
        status: 'online',
        room: null,
        score: 0
    });

    socket.on('readyToCompete', (userData) => {
        users.get(socket.id).username = userData.username;
        addToQueue(socket);
    });

    socket.on('submitCode', (submission) => {
        handleSubmission(socket, submission);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

function addToQueue(socket:Socket) {
    const userInfo = users.get(socket.id);
    
    if (userInfo.status !== 'online') return;
    
    waitingQueue.push(socket.id);
    userInfo.status = 'waiting';
    
    socket.emit('waitingForOpponent');
    matchUsers();
}

function matchUsers() {
    while (waitingQueue.length >= 2) {
        const user1Id = waitingQueue.shift();
        const user2Id = waitingQueue.shift();
        
        const socket1 = io.sockets.sockets.get(user1Id!);
        const socket2 = io.sockets.sockets.get(user2Id!);
        
        if (socket1 && socket2) {
            startCompetition(socket1, socket2);
        } else {
            if (socket1) waitingQueue.unshift(user1Id!);
            if (socket2) waitingQueue.unshift(user2Id!);
        }
    }
}

function startCompetition(socket1:Socket, socket2:Socket) {
    const roomId = `competition_${Date.now()}`;
    const question = selectRandomQuestion();
    
    const user1Info = users.get(socket1.id);
    const user2Info = users.get(socket2.id);
    
    user1Info.status = 'competing';
    user2Info.status = 'competing';
    user1Info.room = roomId;
    user2Info.room = roomId;
    
    socket1.join(roomId);
    socket2.join(roomId);
    
    const competitionData = {
        roomId,
        users: [
            { id: socket1.id, username: user1Info.username, submitted: false },
            { id: socket2.id, username: user2Info.username, submitted: false }
        ],
        question,
        startTime: Date.now(),
        endTime: Date.now() + (5 * 60 * 1000), 
        winner: null
    };
    
    competitionRooms.set(roomId, competitionData);
    
    io.to(roomId).emit('competitionStart', {
        opponent: {
            [socket1.id]: user2Info.username,
            [socket2.id]: user1Info.username
        },
        question,
        timeLimit: 5 * 60, 
        roomId
    });
    
    setTimeout(() => {
        endCompetition(roomId, 'timeout');
    }, 5 * 60 * 1000);
}

async function handleSubmission(socket:Socket, submission:any) {
    const userInfo = users.get(socket.id);
    if (!userInfo.room) return;
    
    const room = competitionRooms.get(userInfo.room);
    if (!room || room.winner) return;
    
    const results:any = await validateSubmission(submission, room.question);
    const isCorrect = results.passed === 3;
    if (isCorrect) {
        if (!room.winner) {
            room.winner = socket.id;
            endCompetition(userInfo.room, 'solved');
        }
    } else {
        socket.emit('submissionResult', {
            status: 'failed',
            message: 'Test cases failed',
            details: results
        });
    }
}

function endCompetition(roomId:string, reason:string) {
    const room = competitionRooms.get(roomId);
    if (!room) return;
    
    const result = {
        reason,
        winner: room.winner ? users.get(room.winner).username : null,
        timeSpent: (Date.now() - room.startTime) / 1000
    };
    
    io.to(roomId).emit('competitionEnd', result);
    
    room.users.forEach((user:{id:string}) => {
        const socket = io.sockets.sockets.get(user.id);
        if (socket) {
            socket.leave(roomId);
            const userInfo = users.get(user.id);
            userInfo.status = 'online';
            userInfo.room = null;
        }
    });
    
    competitionRooms.delete(roomId);
}

function handleDisconnect(socket:Socket) {
    const userInfo = users.get(socket.id);
    
    if (userInfo.room) {
        const room = competitionRooms.get(userInfo.room);
        if (room) {
            endCompetition(userInfo.room, 'disconnected');
        }
    }
    
    const queueIndex = waitingQueue.indexOf(socket.id);
    if (queueIndex > -1) {
        waitingQueue.splice(queueIndex, 1);
    }
    
    users.delete(socket.id);
}

function selectRandomQuestion() {
    return questions[Math.floor(Math.random() * questions.length)];
}

async function validateSubmission(submission:{
    code:string,
}, question:{
    id:number,
    question: string;
    functionSignature: string;
    example: string;
    difficulty: string;
    testCases: {
        input: any;
        output: any;
    }[];
}) {

    try {
        // const executor = new CodeExecutor(3000);
        // const result = await executor.executeCode(submission, question["testCases"]); // Use question.testCases instead of testCases);
        const result = evaluateUserCode(submission.code, question.id)

        return result;
      } catch (error) {
        console.error('Execution failed:', error);
      }
}
}


