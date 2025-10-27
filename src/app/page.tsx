// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './chess.css';

type PieceType = 'king' | 'warrior' | 'defender' | 'paladin' | 'mage' | 'spearman' | 'archer' | 'bard' | 'assassin';
type PieceColor = 'white' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
  state?: number;
}

type Board = (Piece | null)[][];

const pieceSymbols: Record<PieceType, string> = {
  king: '♔',
  warrior: '⚔',
  defender: '🛡',
  paladin: '✝',
  mage: '🔮',
  spearman: '🗡',
  archer: '🏹',
  bard: '🎵',
  assassin: '🗡',
};

const pieceNames: Record<PieceType, string> = {
  king: '킹',
  warrior: '용사',
  defender: '방어병',
  paladin: '팔라딘',
  mage: '마법병',
  spearman: '창술사',
  archer: '궁병',
  bard: '음유시인',
  assassin: '암살병',
};
// app/page.tsx에서 initialBoard 부분만 수정

const initialBoard: Board = [
  [
    { type: 'assassin', color: 'black' },
    { type: 'archer', color: 'black' },
    { type: 'king', color: 'black' }, // ✅ 킹과 창술사 위치 변경
    { type: 'mage', color: 'black', state: 2 },
    { type: 'spearman', color: 'black' }, // ✅ 킹과 창술사 위치 변경
    { type: 'paladin', color: 'black' },
    { type: 'bard', color: 'black' },
    { type: 'warrior', color: 'black', state: 0 },
  ],
  [
    { type: 'defender', color: 'black' },
    { type: 'defender', color: 'black' },
    null,
    null,
    null,
    null,
    { type: 'defender', color: 'black' },
    { type: 'defender', color: 'black' },
  ],
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  [
    { type: 'defender', color: 'white' },
    { type: 'defender', color: 'white' },
    null,
    null,
    null,
    null,
    { type: 'defender', color: 'white' },
    { type: 'defender', color: 'white' },
  ],
  [
    { type: 'warrior', color: 'white', state: 0 },
    { type: 'bard', color: 'white' },
    { type: 'paladin', color: 'white' },
    { type: 'spearman', color: 'white' }, // ✅ 킹과 창술사 위치 변경
    { type: 'mage', color: 'white', state: 2 },
    { type: 'king', color: 'white' }, // ✅ 킹과 창술사 위치 변경
    { type: 'archer', color: 'white' },
    { type: 'assassin', color: 'white' },
  ],
];


export default function CustomChessGame() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>('white');
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [attackRanges, setAttackRanges] = useState<[number, number][]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  
  // 멀티플레이 상태
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);

  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:3000';

    console.log('🔌 Socket.IO 연결 시도:', socketUrl);

    const newSocket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO 연결 성공! ID:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO 연결 실패:', error.message);
    });

    setSocket(newSocket);

    newSocket.on('gameCreated', ({ gameId, color }) => {
      console.log('🎮 게임 생성됨:', gameId);
      setGameId(gameId);
      setPlayerColor(color);
      setWaitingForPlayer(true);
    });

    newSocket.on('gameJoined', ({ gameId, color }) => {
      console.log('👥 게임 참가:', gameId);
      setGameId(gameId);
      setPlayerColor(color);
    });

    newSocket.on('gameStart', () => {
      console.log('🚀 게임 시작!');
      setWaitingForPlayer(false);
      setIsMultiplayer(true);
    });

    newSocket.on('opponentMove', ({ board, currentPlayer }) => {
      console.log('♟️ 상대방 이동');
      setBoard(board);
      setCurrentPlayer(currentPlayer);
    });

    newSocket.on('gameOver', ({ winner }) => {
      setGameOver(winner);
    });

    newSocket.on('playerDisconnected', () => {
      alert('상대방이 연결을 끊었습니다.');
      resetGame();
    });

    newSocket.on('error', (message) => {
      console.error('⚠️ 서버 오류:', message);
      alert(message);
    });

    return () => {
      console.log('🔌 Socket.IO 연결 해제');
      newSocket.close();
    };
  }, []);

  const createGame = () => {
    console.log('🎮 게임 생성 요청, Socket 상태:', socket?.connected);
    if (socket && socket.connected) {
      socket.emit('createGame');
    } else {
      alert('소켓 연결이 없습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const joinGame = () => {
    const id = prompt('게임 ID를 입력하세요:');
    if (id && socket && socket.connected) {
      console.log('🔍 게임 참가 시도:', id);
      socket.emit('joinGame', id);
      setIsMultiplayer(true);
    } else if (!socket?.connected) {
      alert('소켓 연결이 없습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const getBardBonus = (row: number, col: number, color: PieceColor): number => {
    let bonus = 0;
    for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'bard' && piece.color === color) {
          bonus = 1;
        }
      }
    }
    return bonus;
  };

  const canAssassinMove = (fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
    const getQuadrant = (row: number, col: number): number => {
      if (row < 4 && col >= 4) return 1;
      if (row < 4 && col < 4) return 2;
      if (row >= 4 && col < 4) return 3;
      if (row >= 4 && col >= 4) return 4;
      return 0;
    };

    const fromQuad = getQuadrant(fromRow, fromCol);
    const toQuad = getQuadrant(toRow, toCol);
    const nextQuad = (fromQuad % 4) + 1;
    return toQuad === nextQuad;
  };

  const getValidMoves = (row: number, col: number): [number, number][] => {
    const piece = board[row][col];
    if (!piece) return [];

    const moves: [number, number][] = [];
    const bardBonus = getBardBonus(row, col, piece.color);

    switch (piece.type) {
      case 'king':
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            if (r === 0 && c === 0) continue;
            const newRow = row + r;
            const newCol = col + c;
            if (isValidPosition(newRow, newCol)) {
              const target = board[newRow][newCol];
              if (!target || target.color !== piece.color) {
                moves.push([newRow, newCol]);
              }
            }
          }
        }
        break;

      case 'defender':
        const defenderDir = piece.color === 'white' ? -1 : 1;
        for (let c = -1; c <= 1; c++) {
          const newRow = row + defenderDir;
          const newCol = col + c;
          if (isValidPosition(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target) {
              moves.push([newRow, newCol]);
            }
          }
        }
        break;

      case 'warrior':
        if (piece.state === 0) {
          const range = 1 + bardBonus;
          for (let r = -range; r <= range; r++) {
            for (let c = -range; c <= range; c++) {
              if (r === 0 && c === 0) continue;
              const newRow = row + r;
              const newCol = col + c;
              if (isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target) {
                  moves.push([newRow, newCol]);
                }
              }
            }
          }
        }
        break;

      case 'paladin':
        const paladinRange = 2 + bardBonus;
        for (let r = -paladinRange; r <= paladinRange; r++) {
          for (let c = -paladinRange; c <= paladinRange; c++) {
            if (r === 0 && c === 0) continue;
            const newRow = row + r;
            const newCol = col + c;
            if (isValidPosition(newRow, newCol)) {
              const target = board[newRow][newCol];
              if (!target) {
                moves.push([newRow, newCol]);
              }
            }
          }
        }
        break;

      case 'mage':
        // ✅ 마법병은 쿨다운 중에만 이동 가능
        if (piece.state && piece.state > 0) {
          const range = 1 + bardBonus;
          for (let r = -range; r <= range; r++) {
            for (let c = -range; c <= range; c++) {
              if (r === 0 && c === 0) continue;
              const newRow = row + r;
              const newCol = col + c;
              if (isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target) {
                  moves.push([newRow, newCol]);
                }
              }
            }
          }
        }
        break;

      case 'spearman':
        const spearDir = piece.color === 'white' ? -1 : 1;
        const spearRange = 3 + bardBonus;
        for (let i = 1; i <= spearRange; i++) {
          const newRow = row + (spearDir * i);
          if (isValidPosition(newRow, col)) {
            const target = board[newRow][col];
            if (!target) {
              moves.push([newRow, col]);
            } else {
              break;
            }
          }
        }
        break;

      case 'archer':
        break;

      case 'bard':
        const bardRange = 1 + bardBonus;
        for (let r = -bardRange; r <= bardRange; r++) {
          for (let c = -bardRange; c <= bardRange; c++) {
            if (r === 0 && c === 0) continue;
            const newRow = row + r;
            const newCol = col + c;
            if (isValidPosition(newRow, newCol)) {
              const target = board[newRow][newCol];
              if (!target) {
                moves.push([newRow, newCol]);
              }
            }
          }
        }
        break;

      case 'assassin':
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (r === row && c === col) continue;
            if (canAssassinMove(row, col, r, c)) {
              const target = board[r][c];
              if (!target) {
                moves.push([r, c]);
              }
            }
          }
        }
        break;
    }

    return moves;
  };

  const getAttackRange = (row: number, col: number): [number, number][] => {
    const piece = board[row][col];
    if (!piece) return [];

    const attacks: [number, number][] = [];

    switch (piece.type) {
      case 'king':
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            if (r === 0 && c === 0) continue;
            const newRow = row + r;
            const newCol = col + c;
            if (isValidPosition(newRow, newCol)) {
              const target = board[newRow][newCol];
              if (target && target.color !== piece.color) {
                attacks.push([newRow, newCol]);
              }
            }
          }
        }
        break;

      case 'defender':
        const defenderDir = piece.color === 'white' ? -1 : 1;
        for (let c = -1; c <= 1; c++) {
          const newRow = row + defenderDir;
          const newCol = col + c;
          if (isValidPosition(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (target && target.color !== piece.color) {
              attacks.push([newRow, newCol]);
            }
          }
        }
        break;

      case 'warrior':
        if (piece.state === 1) {
          for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
              if (r === 0 && c === 0) continue;
              const newRow = row + r;
              const newCol = col + c;
              if (isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (target && target.color !== piece.color) {
                  attacks.push([newRow, newCol]);
                }
              }
            }
          }
        } else if (piece.state === 2) {
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === 0 && c === 0) continue;
              const newRow = row + r;
              const newCol = col + c;
              if (isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (target && target.color !== piece.color) {
                  attacks.push([newRow, newCol]);
                }
              }
            }
          }
        }
        break;

      case 'paladin':
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === 0 && c === 0) continue;
            const newRow = row + r;
            const newCol = col + c;
            if (isValidPosition(newRow, newCol)) {
              const target = board[newRow][newCol];
              if (target && target.color !== piece.color) {
                attacks.push([newRow, newCol]);
              }
            }
          }
        }
        break;

      case 'mage':
        // ✅ 쿨다운이 0일 때만 공격 가능
        if (!piece.state || piece.state === 0) {
          for (let c = 0; c < 8; c++) {
            if (c !== col) {
              const target = board[row][c];
              if (target && target.color !== piece.color) {
                attacks.push([row, c]);
              }
            }
          }
          for (let r = 0; r < 8; r++) {
            if (r !== row) {
              const target = board[r][col];
              if (target && target.color !== piece.color) {
                attacks.push([r, col]);
              }
            }
          }
        }
        break;

      case 'spearman':
        const spearDir = piece.color === 'white' ? -1 : 1;
        const targetRow = row + (spearDir * 3);
        if (isValidPosition(targetRow, col)) {
          const target = board[targetRow][col];
          if (target && target.color !== piece.color) {
            attacks.push([targetRow, col]);
          }
        }
        break;

      case 'archer':
        const archerDir = piece.color === 'white' ? -1 : 1;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const rowDiff = (r - row) * archerDir;
            const colDiff = Math.abs(c - col);
            const distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
            if (rowDiff > 0 && distance <= 4) {
              const target = board[r][c];
              if (target && target.color !== piece.color) {
                attacks.push([r, c]);
              }
            }
          }
        }
        break;

      case 'bard':
        break;

      case 'assassin':
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (r === row && c === col) continue;
            if (canAssassinMove(row, col, r, c)) {
              const target = board[r][c];
              if (target && target.color !== piece.color) {
                attacks.push([r, c]);
              }
            }
          }
        }
        break;
    }

    return attacks;
  };

  const isValidPosition = (row: number, col: number): boolean => {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  };

  // ✅ 턴 종료 시 모든 마법병의 쿨다운 감소
  const decreaseMageCooldowns = (board: Board): Board => {
    return board.map(row => 
      row.map(piece => {
        if (piece && piece.type === 'mage' && piece.state && piece.state > 0) {
          return { ...piece, state: piece.state - 1 };
        }
        return piece;
      })
    );
  };

  const handleSquareClick = (row: number, col: number) => {
    if (gameOver) return;
    
    if (isMultiplayer && playerColor !== currentPlayer) return;

    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const piece = board[fromRow][fromCol];

      if (piece && piece.color === currentPlayer) {
        const moves = validMoves;
        const attacks = attackRanges;

        if (attacks.some(([r, c]) => r === row && c === col)) {
          const target = board[row][col];
          if (target && target.color !== piece.color) {
            let newBoard = board.map(r => [...r]);
            
            if (target.type === 'king') {
              const winner = piece.color === 'white' ? '백' : '흑';
              setGameOver(`${winner} 승리!`);
              if (socket && isMultiplayer) {
                socket.emit('gameOver', { gameId, winner });
              }
            }

            newBoard[row][col] = { ...piece };
            newBoard[fromRow][fromCol] = null;

            // ✅ 마법병 공격 후 쿨다운 2턴 설정
            if (piece.type === 'mage') {
              newBoard[row][col]!.state = 2;
            } else if (piece.type === 'warrior') {
              newBoard[row][col]!.state = ((piece.state || 0) + 1) % 3;
            }

            // ✅ 턴 종료 시 쿨다운 감소
            newBoard = decreaseMageCooldowns(newBoard);

            const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
            setBoard(newBoard);
            setCurrentPlayer(nextPlayer);

            if (socket && isMultiplayer) {
              socket.emit('move', { gameId, board: newBoard, currentPlayer: nextPlayer });
            }
          }
        } else if (moves.some(([r, c]) => r === row && c === col)) {
          let newBoard = board.map(r => [...r]);
          newBoard[row][col] = { ...piece };
          newBoard[fromRow][fromCol] = null;

          if (piece.type === 'warrior') {
            newBoard[row][col]!.state = ((piece.state || 0) + 1) % 3;
          }

          // ✅ 턴 종료 시 쿨다운 감소
          newBoard = decreaseMageCooldowns(newBoard);

          const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
          setBoard(newBoard);
          setCurrentPlayer(nextPlayer);

          if (socket && isMultiplayer) {
            socket.emit('move', { gameId, board: newBoard, currentPlayer: nextPlayer });
          }
        }
      }

      setSelectedSquare(null);
      setValidMoves([]);
      setAttackRanges([]);
      
    } else {
      const piece = board[row][col];
      if (piece && piece.color === currentPlayer) {
        setSelectedSquare([row, col]);
        const moves = getValidMoves(row, col);
        const attacks = getAttackRange(row, col);
        setValidMoves(moves);
        setAttackRanges(attacks);
      }
    }
  };

  const resetGame = () => {
    setBoard(initialBoard);
    setSelectedSquare(null);
    setValidMoves([]);
    setAttackRanges([]);
    setCurrentPlayer('white');
    setGameOver(null);
    setIsMultiplayer(false);
    setPlayerColor(null);
    setGameId('');
    setWaitingForPlayer(false);
  };

  return (
    <div className="game-container">
      <h1>커스텀 전략 체스</h1>
      
      {!isMultiplayer && !waitingForPlayer && (
        <div className="multiplayer-menu">
          <button onClick={createGame} className="menu-button">게임 생성</button>
          <button onClick={joinGame} className="menu-button">게임 참가</button>
          <button onClick={() => setIsMultiplayer(false)} className="menu-button">로컬 게임</button>
        </div>
      )}

      {waitingForPlayer && (
        <div className="waiting-message">
          <p>게임 ID: <strong>{gameId}</strong></p>
          <p>상대방을 기다리는 중...</p>
        </div>
      )}

      <div className="game-info">
        <p>현재 차례: {currentPlayer === 'white' ? '백' : '흑'}</p>
        {isMultiplayer && playerColor && (
          <p>당신의 색: {playerColor === 'white' ? '백' : '흑'}</p>
        )}
        {selectedSquare && board[selectedSquare[0]][selectedSquare[1]] && (
          <p className="selected-piece">
            선택: {pieceNames[board[selectedSquare[0]][selectedSquare[1]]!.type]}
            {board[selectedSquare[0]][selectedSquare[1]]!.type === 'warrior' && 
              ` (${['이동', '약공격', '강공격'][board[selectedSquare[0]][selectedSquare[1]]!.state || 0]})`}
            {board[selectedSquare[0]][selectedSquare[1]]!.type === 'mage' && (
              board[selectedSquare[0]][selectedSquare[1]]!.state && board[selectedSquare[0]][selectedSquare[1]]!.state! > 0
                ? ` (🕐 쿨다운: ${board[selectedSquare[0]][selectedSquare[1]]!.state}턴)`
                : ' (⚡ 공격 가능!)'
            )}
          </p>
        )}
        <button onClick={resetGame} className="reset-button">
          게임 리셋
        </button>
      </div>

      {gameOver && (
        <div className="game-over-modal">
          <div className="modal-content">
            <h2>{gameOver}</h2>
            <button onClick={resetGame} className="modal-button">새 게임</button>
          </div>
        </div>
      )}

      <div className="chess-board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="board-row">
            {row.map((piece, colIndex) => {
              const isLight = (rowIndex + colIndex) % 2 === 0;
              const isSelected =
                selectedSquare &&
                selectedSquare[0] === rowIndex &&
                selectedSquare[1] === colIndex;
              const isValidMove = validMoves.some(([r, c]) => r === rowIndex && c === colIndex);
              const isAttackRange = attackRanges.some(([r, c]) => r === rowIndex && c === colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`square ${isLight ? 'light' : 'dark'} ${
                    isSelected ? 'selected' : ''
                  } ${isValidMove ? 'valid-move' : ''} ${isAttackRange ? 'attack-range' : ''}`}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                >
                  {piece && (
                    <div className={`piece ${piece.color}`}>
                      <span className="piece-symbol">{pieceSymbols[piece.type]}</span>
                      <span className="piece-name">{pieceNames[piece.type]}</span>
                      {/* ✅ 마법병 쿨다운 표시 */}
                      {piece.type === 'mage' && piece.state && piece.state > 0 && (
                        <span className="cooldown-indicator">{piece.state}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="legend">
        <h3>기물 설명</h3>
        <div className="legend-grid">
          <div><strong>🛡 방어병:</strong> 앞 가로 3칸 방어 & 이동</div>
          <div><strong>⚔ 용사:</strong> 이동→약공격→강공격 반복</div>
          <div><strong>✝ 팔라딘:</strong> 넓은 방어(2칸), 2칸 이동</div>
          <div><strong>🔮 마법병:</strong> 십자 강공격 후 2턴 쿨다운 (초기 2턴)</div>
          <div><strong>🗡 창술사:</strong> 앞 3칸 이동, 끝만 공격</div>
          <div><strong>🏹 궁병:</strong> 반원 공격, 이동 불가</div>
          <div><strong>🎵 음유시인:</strong> 주변 기물 이동+1</div>
          <div><strong>🗡 암살병:</strong> 시계방향 사분면 이동</div>
        </div>
        
        <div className="color-legend">
          <div className="color-item">
            <div className="color-box selected"></div>
            <span>선택된 기물</span>
          </div>
          <div className="color-item">
            <div className="color-box move"></div>
            <span>이동 가능 (파란색)</span>
          </div>
          <div className="color-item">
            <div className="color-box attack"></div>
            <span>공격 범위 (빨간색)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
