import { useState, useEffect, CSSProperties, useRef, useCallback } from "react";
import { GridChildComponentProps } from "react-window";
import {
  Ethscription,
  addToFetchQueue,
  fetchQueue,
  getEthscriptionCache,
  subscribeToEthscription,
} from "./fetchEthscriptions";
import { getWalletColor } from "./utils";
import { GRID_SIZE } from "./InfiniteGrid";

interface CellProps extends GridChildComponentProps {
  data: {
    originX: React.MutableRefObject<number>;
    originY: React.MutableRefObject<number>;
  };
}

export const Cell: React.FC<CellProps> = ({
  columnIndex,
  rowIndex,
  style,
  data,
}) => {
  const [neighbors, setNeighbors] = useState<{
    [key: string]: Ethscription | null;
  }>({});
  const unsubscribesRef = useRef<(() => void)[]>([]);
  const x = columnIndex + data.originX.current - Math.floor(GRID_SIZE / 2);
  const y = (rowIndex + data.originY.current - Math.floor(GRID_SIZE / 2)) * -1;

  const [cellData, setCellData] = useState<{
    ethscription?: Ethscription | null;
  } | null>(null);

  useEffect(() => {
    setCellData(null);

    addToFetchQueue({ x, y, subscribers: [] })
      .then((ethscription) => {
        setCellData({ ethscription });
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      const requestIndex = fetchQueue.findIndex(
        (request) => request.x === x && request.y === y
      );

      if (requestIndex !== -1) {
        fetchQueue.splice(requestIndex, 1);
      }
    };
  }, [x, y]);

  const updateNeighbors = useCallback(() => {
    const rightNeighbor = getEthscriptionCache(x + 1, y)?.ethscription;
    const bottomNeighbor = getEthscriptionCache(x, y - 1)?.ethscription;

    const didRightChange =
      rightNeighbor?.current_owner !== neighbors.right?.current_owner;
    const didBottomChange =
      bottomNeighbor?.current_owner !== neighbors.bottom?.current_owner;

    if (didRightChange || didBottomChange) {
      setNeighbors({
        right: rightNeighbor,
        bottom: bottomNeighbor,
      });
    }
  }, [neighbors, x, y]);

  useEffect(() => {
    if (cellData) {
      Promise.all([
        subscribeToEthscription(x + 1, y, updateNeighbors),
        subscribeToEthscription(x, y - 1, updateNeighbors),
      ]).then((unsubCallbacks) => {
        unsubscribesRef.current = unsubCallbacks;
      });
      // Cleanup function
      return () => {
        unsubscribesRef.current.forEach((unsubscribe) => unsubscribe());
      };
    }
  }, [cellData, updateNeighbors, x, y]);

  const walletColor = cellData?.ethscription?.current_owner
    ? getWalletColor(cellData.ethscription.current_owner)
    : "";

  let borderStyle: CSSProperties = {
    borderBottom: "2px solid black",
    borderRight: "2px solid black",
  };

  // Compare with top cell
  if (cellData?.ethscription?.current_owner) {
    const currentOwner = cellData?.ethscription?.current_owner;
    if (neighbors.bottom && neighbors.bottom?.current_owner === currentOwner) {
      delete borderStyle["borderBottom"];
    }
    if (neighbors.right && neighbors.right?.current_owner === currentOwner) {
      delete borderStyle["borderRight"];
    }
  }

  return (
    <div style={style as CSSProperties}>
      {cellData?.ethscription?.current_owner ? (
        <a
          href={`https://ethscriptions.com/ethscriptions/${cellData?.ethscription.transaction_hash}`}
          target="_blank"
        >
          <div
            className={`w-full h-full flex flex-col items-center justify-center transition-all duration-200 hover:opacity-90`}
            style={{
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              imageRendering: "pixelated",
              backgroundColor: walletColor, // fallback background color
              position: "relative",
              ...borderStyle,
            }}
          >
            <div>{`${x},${y}`}</div>
          </div>
        </a>
      ) : (
        <div
          className={
            cellData
              ? `w-full h-full flex flex-col items-center justify-center gap-4`
              : "animate-pulse w-full h-full flex items-center justify-center text-black bg-white"
          }
          style={borderStyle}
        >
          <div>{`${x},${y}`}</div>
          {!!cellData && (
            <div className="bg-green-500 border border-green-700 text-black px-2 py-1 rounded-md">
              Available
            </div>
          )}
        </div>
      )}
    </div>
  );
};
