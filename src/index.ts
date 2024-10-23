import axios from 'axios';
import { Elysia } from 'elysia';

const app = new Elysia();


const SOCKET_API_URL = 'https://api.socket.tech/v2/quote';
const API_KEY = 'YOUR_SOCKET_API_KEY'; // Replace with your actual Socket API Key

// Fetch bridging routes from Socket API
async function getBridgingRoute(fromChainId: number, toChainId: number, amount: number, tokenAddress: string) {
    try {
        const response = await axios.get(SOCKET_API_URL, {
            params: {
                fromChainId: fromChainId,
                toChainId: toChainId,
                fromAmount: amount.toString(),
                fromTokenAddress: tokenAddress
            },
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching bridging routes:', error);
        return null;
    }
}

// Example balances of USDC on different chains
const userBalances: { [key: string]: number } = {
    Polygon: 50 * 1e6,  // 50 USDC
    Arbitrum: 100 * 1e6, // 100 USDC
    Base: 80 * 1e6       // 80 USDC
};

// Assume the bridging fees (replace with actual Socket API data later)
const bridgeFees = {
    ArbitrumToPolygon: 1 * 1e6,  // 1 USDC fee
    BaseToPolygon: 0.5 * 1e6     // 0.5 USDC fee
};

async function calculateBridging(targetChain: string, amountRequired: number, tokenAddress: string) {
    const targetChainBalance = userBalances[targetChain] || 0;

    // If the balance on the target chain is sufficient, no bridging needed
    if (targetChainBalance >= amountRequired) {
        return {
            message: "No bridging required",
            totalBridged: 0,
            routes: []
        };
    }

    // Calculate how much more is needed to bridge
    let remainingAmount = amountRequired - targetChainBalance;
    let routes = [];
    let totalBridged = 0;

    // First option: Use Arbitrum funds if available
    if (userBalances.Arbitrum > 0) {
        const availableFromArbitrum = userBalances.Arbitrum - bridgeFees.ArbitrumToPolygon;
        const amountToBridge = Math.min(availableFromArbitrum, remainingAmount);
        
        if (amountToBridge > 0) {
            routes.push({
                from: "Arbitrum",
                to: targetChain,
                amount: amountToBridge / 1e6, // Convert back to readable USDC format
                fee: bridgeFees.ArbitrumToPolygon / 1e6
            });
            totalBridged += amountToBridge;
            remainingAmount -= amountToBridge;
        }
    }

    // Second option: Use Base funds if still more funds are needed
    if (remainingAmount > 0 && userBalances.Base > 0) {
        const availableFromBase = userBalances.Base - bridgeFees.BaseToPolygon;
        const amountToBridge = Math.min(availableFromBase, remainingAmount);
        
        if (amountToBridge > 0) {
            routes.push({
                from: "Base",
                to: targetChain,
                amount: amountToBridge / 1e6, // Convert back to readable USDC format
                fee: bridgeFees.BaseToPolygon / 1e6
            });
            totalBridged += amountToBridge;
            remainingAmount -= amountToBridge;
        }
    }

    return {
        totalBridged: totalBridged / 1e6,
        routes,
        remainingAmount: remainingAmount / 1e6
    };
}

app.get("/bridge", async (req) => {
    const { targetChain, amount, tokenAddress } = req.query;

    const result = await calculateBridging(targetChain || "", Number(amount), tokenAddress  || "");
    return result;
});

// Start the server on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

