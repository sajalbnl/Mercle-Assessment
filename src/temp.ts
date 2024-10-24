

type Chain = {
    name: string;
    balance: number;
    chainId: number;
    tokenAddress:string 
};

const userBalances: Chain[] = [
    { name: "Polygon", chainId: 137, balance: 50 * 1e6,tokenAddress:"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },  
    { name: "Arbitrum", chainId: 42161, balance: 100 * 1e6,tokenAddress:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { name: "Base", chainId: 8453, balance: 80 * 1e6,tokenAddress:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },     
    // { name: "Gnosis", chainId: 100, balance: 25 * 1e6 },
    // { name: "Blast", chainId: 81457, balance: 30 * 1e6 }  
];


function findAllCombinations(chains: Chain[], targetAmount: number) {
    const result: Array<Chain[]> = [];

    function backtrack(startIndex: number, currentRoute: Chain[], currentTotal: number) {

        if (currentTotal >= targetAmount) {
            result.push([...currentRoute]); 
            return; 
        }

    
        for (let i = startIndex; i < chains.length; i++) {
            if (chains[i].balance > 0) { 
                currentRoute.push(chains[i]);
                backtrack(i + 1, currentRoute, currentTotal + chains[i].balance)
                currentRoute.pop(); 
            }
        }
    }
    backtrack(0, [], 0);

    return result;
}

function calculateBridging(targetChainId: number, amountRequired: number) {
    const targetChain = userBalances.find(chain => chain.chainId === targetChainId);

    if (!targetChain) {
        throw new Error("Target chain not found in user balances.");
    }

    const targetAmountInSmallestUnits = amountRequired * 1e6;
    const remainingAmount = targetAmountInSmallestUnits - targetChain.balance; 

    const otherChains = userBalances.filter(chain => chain.chainId !== targetChainId);
    const combinations = findAllCombinations(otherChains, remainingAmount);

   
    const formattedCombinations = combinations.map(combination => {
        const routes = combination.map(chain => ({
            from: chain.chainId,
            to:targetChain.chainId,
            fromTokenAddress:chain.tokenAddress,
            toTokenAddress:targetChain.tokenAddress,
            amount: chain.balance / 1e6 
        }));

        return [
            ...routes,
        ];
    });

    return formattedCombinations;
}


// Example Usage
const targetChainId = 137;  
const targetAmount = 60;  
console.log(calculateBridging(targetChainId, targetAmount));
