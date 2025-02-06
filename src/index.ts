import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import {createServer} from 'http';
import {Server} from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import {setupSocket} from './routes/socket.route'

const app: Express = express();
const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});


// Extend Express types to include io property
declare global {
  namespace Express {
    interface Application {
      io: Server;
    }
  }
}

const server = createServer(app); 
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


setupSocket(io);

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
