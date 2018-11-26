pragma solidity 0.4.24;

import "../math/SafeMath.sol";
import "../ownership/Ownable.sol";
import "../token/MintableToken.sol";
import "./RateSourceInterface.sol";


/// @title MintingCrowdsale
/// @author SICOS
contract MintingCrowdsale is Ownable {
    using SafeMath for uint;

    // Ethereum address of rate setting authority
    address public rateSource;

    // The token to be sold
    // In the following, the term "token unit" always refers to the smallest
    // and non-divisible quantum. Thus, token unit amounts are always integers.
    // One token is expected to consist of 10^18 token units.
    MintableToken public token;

    // Token amounts in token units
    // The public and the private sale are both capped (i.e. two distinct token pools)
    // The tokenRemaining variables keep track of how many token units are available
    // for the respective type of sale
    uint public tokenCapOfPublicSale;
    uint public tokenCapOfPrivateSale;
    uint public tokenRemainingForPublicSale;
    uint public tokenRemainingForPrivateSale;

    // Prices are in Euro cents (i.e. 1/100 EUR)
    uint public tokenPrice;

    //
    uint public tokenPurchaseMinimum;

    // Public sale period
    uint public openingTime;
    uint public closingTime;

    // Ethereum address where invested funds will be transferred to
    address public companyWallet;

    // Amount and receiver of reserved tokens
    uint public tokenReservePerMill;
    address public reserveAccount;

    // Wether this crowdsale was finalized or not
    bool public isFinalized = false;


    /// @dev Log entry upon token distribution event
    /// @param beneficiary Ethereum address of token recipient
    /// @param amount Number of token units
    event TokenDistribution(address indexed beneficiary, uint amount);

    /// @dev Log entry upon token purchase event
    /// @param buyer Ethereum address of token purchaser
    /// @param value Worth in wei of purchased token amount
    /// @param amount Number of token units
    event TokenPurchase(address indexed buyer, uint value, uint amount);

    /// @dev Log entry upon finalization event
    event Finalization();


    /// @dev Constructor
    /// @param _token The token to be sold
    /// @param _tokenCapOfPublicSale Maximum number of token units to mint in public sale
    /// @param _tokenCapOfPrivateSale Maximum number of token units to mint in private sale
    /// @param _tokenPurchaseMinimum Minimum amount of tokens an investor has to buy at once
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _rateSource Ethereum address of ether rate setting authority
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _tokenReservePerMill Per mill amount of sold tokens to mint for reserve account
    /// @param _reserveAccount Ethereum address of reserve tokens recipient
    constructor(
        MintableToken _token,
        uint _tokenCapOfPublicSale,
        uint _tokenCapOfPrivateSale,
        uint _tokenPurchaseMinimum,
        uint _tokenReservePerMill,
        uint _tokenPrice,
        address _rateSource,
        uint _openingTime,
        uint _closingTime,
        address _companyWallet,
        address _reserveAccount
    )
        public
    {
        require(address(_token) != address(0x0), "Token address is zero");
        require(_token.minter() == address(0x0), "Token has another minter");
        require(_tokenCapOfPublicSale > 0, "Cap of public sale is zero");
        require(_tokenCapOfPrivateSale > 0, "Cap of private sale is zero");
        require(_tokenPurchaseMinimum <= _tokenCapOfPublicSale
                && _tokenPurchaseMinimum <= _tokenCapOfPrivateSale,
                "Purchase minimum exceeds cap");
        require(_tokenPrice > 0, "Token price is zero");
        require(_rateSource != address(0x0), "Rate source is zero");
        require(_openingTime >= now, "Opening lies in the past");
        require(_closingTime >= _openingTime, "Closing lies before opening");
        require(_companyWallet != address(0x0), "Company wallet is zero");
        require(_reserveAccount != address(0x0), "Reserve account is zero");

        // Utilize safe math to ensure the sum of three token pools does't overflow
        _tokenCapOfPublicSale.add(_tokenCapOfPrivateSale).mul(_tokenReservePerMill);

        token = _token;
        tokenCapOfPublicSale = _tokenCapOfPublicSale;
        tokenCapOfPrivateSale = _tokenCapOfPrivateSale;
        tokenPurchaseMinimum = _tokenPurchaseMinimum;
        tokenReservePerMill = _tokenReservePerMill;
        tokenPrice = _tokenPrice;
        rateSource = _rateSource;
        openingTime = _openingTime;
        closingTime = _closingTime;
        companyWallet = _companyWallet;
        reserveAccount = _reserveAccount;

        tokenRemainingForPublicSale = _tokenCapOfPublicSale;
        tokenRemainingForPrivateSale = _tokenCapOfPrivateSale;
    }



    /// @dev Fallback function: buys tokens
    function () public payable {
        buyTokens();
    }

    /// @dev Distribute tokens purchased off-chain via public sale
    /// @param beneficiaries List of recipients' Ethereum addresses
    /// @param amounts List of token units each recipient will receive
    function distributeTokensViaPublicSale(address[] beneficiaries, uint[] amounts) public {
        tokenRemainingForPublicSale =
            distributeTokens(tokenRemainingForPublicSale, beneficiaries, amounts);
    }

    /// @dev Distribute tokens purchased off-chain via private sale
    /// @param beneficiaries List of recipients' Ethereum addresses
    /// @param amounts List of token units each recipient will receive
    function distributeTokensViaPrivateSale(address[] beneficiaries, uint[] amounts) public {
        tokenRemainingForPrivateSale =
            distributeTokens(tokenRemainingForPrivateSale, beneficiaries, amounts);
    }

    /// @dev Check whether the sale has closed
    /// @return True iff sale closing time has passed
    function hasClosed() public view returns (bool) {
        return now >= closingTime;
    }

    /// @dev Check wether the sale is open
    /// @return True iff sale opening time has passed and sale is not closed yet
    function isOpen() public view returns (bool) {
        return now >= openingTime && !hasClosed();
    }

    /// @dev Determine the remaining open time of sale
    /// @return Time in seconds until sale gets closed, or 0 if sale was closed
    function timeRemaining() public view returns (uint) {
        if (hasClosed()) {
            return 0;
        }

        return closingTime - now;
    }

    /// @dev Determine the amount of sold tokens (off-chain and on-chain)
    /// @return Token units amount
    function tokenSold() public view returns (uint) {
        return (tokenCapOfPublicSale - tokenRemainingForPublicSale)
             + (tokenCapOfPrivateSale - tokenRemainingForPrivateSale);
    }

    /// @dev Purchase tokens
    function buyTokens() public payable {
        require(isOpen(), "Sale is not open");

        // Units:  [1e-18*ether] * [cent/ether] / [cent/token] => [1e-18*token]
        uint amount = msg.value.mul(RateSource(rateSource).etherRate()).div(tokenPrice);

        require(amount <= tokenRemainingForPublicSale, "Not enough tokens available");
        require(amount >= tokenPurchaseMinimum, "Investment is too low");

        tokenRemainingForPublicSale = tokenRemainingForPublicSale.sub(amount);
        token.mint(msg.sender, amount);
        forwardFunds();

        emit TokenPurchase(msg.sender, msg.value, amount);
    }

    /// @dev Finalize, i.e. end token minting phase and enable token trading
    function finalize() public onlyOwner {
        require(!isFinalized, "Sale has already been finalized");
        require(hasClosed(), "Sale has not closed");

        if (tokenReservePerMill > 0) {
            token.mint(reserveAccount, tokenSold().mul(tokenReservePerMill).div(1000));
        }
        token.finishMinting();
        isFinalized = true;

        emit Finalization();
    }

    /// @dev Distribute tokens purchased off-chain (in Euro) to investors
    /// @param tokenRemaining Token units available for sale
    /// @param beneficiaries Ethereum addresses of purchasers
    /// @param amounts Token unit amounts to deliver to each investor
    /// @return Token units available for sale after distribution
    function distributeTokens(uint tokenRemaining, address[] beneficiaries, uint[] amounts)
        internal
        onlyOwner
        returns (uint)
    {
        require(!isFinalized, "Sale has been finalized");
        require(beneficiaries.length == amounts.length, "Lengths are different");

        for (uint i = 0; i < beneficiaries.length; ++i) {
            address beneficiary = beneficiaries[i];
            uint amount = amounts[i];

            require(amount <= tokenRemaining, "Not enough tokens available");

            tokenRemaining= tokenRemaining.sub(amount);
            token.mint(beneficiary, amount);

            emit TokenDistribution(beneficiary, amount);
        }

        return tokenRemaining;
    }

    /// @dev Forward invested ether to company wallet
    function forwardFunds() internal {
        companyWallet.transfer(address(this).balance);
    }

}
