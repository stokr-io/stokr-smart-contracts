pragma solidity 0.5.16;

import "../math/SafeMath.sol";
import "../ownership/Ownable.sol";
import "../token/MintableToken.sol";
import "./RateSourceInterface.sol";


/// @title MintingCrowdsale
/// @author STOKR
contract MintingCrowdsale is Ownable {
    using SafeMath for uint;

    // Maximum Time of offering period after extension
    uint constant MAXOFFERINGPERIOD = 183 days;

    // Ether rate oracle contract providing the price of an Ether in EUR cents
    RateSource public rateSource;

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

    // The minimum amount of tokens a purchaser has to buy via one transaction
    uint public tokenPurchaseMinimum;

    // The maximum total amount of tokens a purchaser may buy during start phase
    uint public tokenPurchaseLimit;

    // Total token purchased by investor (while purchase amount is limited)
    mapping(address => uint) public tokenPurchased;

    // Public sale period
    uint public openingTime;
    uint public closingTime;
    uint public limitEndTime;

    // Ethereum address where invested funds will be transferred to
    address payable public companyWallet;

    // Amount and receiver of reserved tokens
    uint public tokenReservePerMill;
    address public reserveAccount;

    // Wether this crowdsale was finalized or not
    bool public isFinalized = false;


    /// @dev Log entry upon token distribution event
    /// @param beneficiary Ethereum address of token recipient
    /// @param amount Number of token units
    /// @param isPublicSale Whether the distribution was via public sale
    event TokenDistribution(address indexed beneficiary, uint amount, bool isPublicSale);

    /// @dev Log entry upon token purchase event
    /// @param buyer Ethereum address of token purchaser
    /// @param value Worth in wei of purchased token amount
    /// @param amount Number of token units
    event TokenPurchase(address indexed buyer, uint value, uint amount);

    /// @dev Log entry upon opening time change event
    /// @param previous Previous opening time of sale
    /// @param current Current opening time of sale
    event OpeningTimeChange(uint previous, uint current);

    /// @dev Log entry upon closing time change event
    /// @param previous Previous closing time of sale
    /// @param current Current closing time of sale
    event ClosingTimeChange(uint previous, uint current);

    /// @dev Log entry upon finalization event
    event Finalization();


    /// @dev Constructor
    /// @param _rateSource Ether rate oracle contract
    /// @param _token The token to be sold
    /// @param _tokenCapOfPublicSale Maximum number of token units to mint in public sale
    /// @param _tokenCapOfPrivateSale Maximum number of token units to mint in private sale
    /// @param _tokenPurchaseMinimum Minimum amount of tokens an investor has to buy at once
    /// @param _tokenPurchaseLimit Maximum total token amounts individually buyable in limit phase
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _limitEndTime Block (Unix) timestamp until token purchases are limited
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _tokenReservePerMill Per mill amount of sold tokens to mint for reserve account
    /// @param _reserveAccount Ethereum address of reserve tokens recipient
    constructor(
        RateSource _rateSource,
        MintableToken _token,
        uint _tokenCapOfPublicSale,
        uint _tokenCapOfPrivateSale,
        uint _tokenPurchaseMinimum,
        uint _tokenPurchaseLimit,
        uint _tokenReservePerMill,
        uint _tokenPrice,
        uint _openingTime,
        uint _closingTime,
        uint _limitEndTime,
        address payable _companyWallet,
        address _reserveAccount
    )
        public
    {
        require(address(_rateSource) != address(0x0), "Rate source is zero");
        require(address(_token) != address(0x0), "Token address is zero");
        require(_token.minter() == address(0x0), "Token has another minter");
        require(_tokenCapOfPublicSale > 0, "Cap of public sale is zero");
        require(_tokenCapOfPrivateSale > 0, "Cap of private sale is zero");
        require(_tokenPurchaseMinimum <= _tokenCapOfPublicSale
                && _tokenPurchaseMinimum <= _tokenCapOfPrivateSale,
                "Purchase minimum exceeds cap");
        require(_tokenPrice > 0, "Token price is zero");
        require(_openingTime >= now, "Opening lies in the past");
        require(_closingTime >= _openingTime, "Closing lies before opening");
        require(_companyWallet != address(0x0), "Company wallet is zero");
        require(_reserveAccount != address(0x0), "Reserve account is zero");


        // Note: There are no time related requirements regarding limitEndTime.
        //       If it's below openingTime, token purchases will never be limited.
        //       If it's above closingTime, token purchases will always be limited.
        if (_limitEndTime > _openingTime) {
            // But, if there's a purchase limitation phase, the limit must be at
            // least the purchase minimum or above to make purchases possible.
            require(_tokenPurchaseLimit >= _tokenPurchaseMinimum,
                    "Purchase limit is below minimum");
        }

        // Utilize safe math to ensure the sum of three token pools does't overflow
        _tokenCapOfPublicSale.add(_tokenCapOfPrivateSale).mul(_tokenReservePerMill);

        rateSource = _rateSource;
        token = _token;
        tokenCapOfPublicSale = _tokenCapOfPublicSale;
        tokenCapOfPrivateSale = _tokenCapOfPrivateSale;
        tokenPurchaseMinimum = _tokenPurchaseMinimum;
        tokenPurchaseLimit= _tokenPurchaseLimit;
        tokenReservePerMill = _tokenReservePerMill;
        tokenPrice = _tokenPrice;
        openingTime = _openingTime;
        closingTime = _closingTime;
        limitEndTime = _limitEndTime;
        companyWallet = _companyWallet;
        reserveAccount = _reserveAccount;

        tokenRemainingForPublicSale = _tokenCapOfPublicSale;
        tokenRemainingForPrivateSale = _tokenCapOfPrivateSale;
    }



    /// @dev Fallback function: buys tokens
    function () external payable {
        require(msg.data.length == 0, "Fallback call with data");

        buyTokens();
    }

    /// @dev Distribute tokens purchased off-chain via public sale
    ///      Note: additional requirements are enforced in internal function.
    /// @param beneficiaries List of recipients' Ethereum addresses
    /// @param amounts List of token units each recipient will receive
    function distributeTokensViaPublicSale(
        address[] memory beneficiaries,
        uint[] memory amounts
    )
        public
    {
        tokenRemainingForPublicSale =
            distributeTokens(tokenRemainingForPublicSale, beneficiaries, amounts, true);
    }

    /// @dev Distribute tokens purchased off-chain via private sale
    ///      Note: additional requirements are enforced in internal function.
    /// @param beneficiaries List of recipients' Ethereum addresses
    /// @param amounts List of token units each recipient will receive
    function distributeTokensViaPrivateSale(
        address[] memory beneficiaries,
        uint[] memory amounts
    )
        public
    {
        tokenRemainingForPrivateSale =
            distributeTokens(tokenRemainingForPrivateSale, beneficiaries, amounts, false);
    }

    /// @dev Check whether the sale has closed
    /// @return True iff sale closing time has passed
    function hasClosed() public view returns (bool) {
        return now >= closingTime || tokenRemainingForPublicSale == 0;
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

        uint etherRate = rateSource.etherRate();

        require(etherRate > 0, "Ether rate is zero");

        // Units:  [1e-18*ether] * [cent/ether] / [cent/token] => [1e-18*token]
        uint amount = msg.value.mul(etherRate).div(tokenPrice);

        require(amount <= tokenRemainingForPublicSale, "Not enough tokens available");
        require(amount >= tokenPurchaseMinimum, "Investment is too low");

        // Is the total amount an investor can purchase with Ether limited?
        if (now < limitEndTime) {
            uint purchased = tokenPurchased[msg.sender].add(amount);

            require(purchased <= tokenPurchaseLimit, "Purchase limit reached");

            tokenPurchased[msg.sender] = purchased;
        }

        tokenRemainingForPublicSale = tokenRemainingForPublicSale.sub(amount);

        token.mint(msg.sender, amount);
        forwardFunds();

        emit TokenPurchase(msg.sender, msg.value, amount);
    }

    /// @dev Change the start time of offering period without changing its duration.
    /// @param _newOpeningTime new openingTime of the crowdsale
    function changeOpeningTime(uint _newOpeningTime) public onlyOwner {
        require(now < openingTime, "Sale has started already");
        require(now < _newOpeningTime, "OpeningTime not in the future");

        uint _newClosingTime = _newOpeningTime + (closingTime - openingTime);

        emit OpeningTimeChange(openingTime, _newOpeningTime);
        emit ClosingTimeChange(closingTime, _newClosingTime);

        openingTime = _newOpeningTime;
        closingTime = _newClosingTime;
    }

    /// @dev Extend the offering period of the crowd sale.
    /// @param _newClosingTime new closingTime of the crowdsale
    function changeClosingTime(uint _newClosingTime) public onlyOwner {
        require(!hasClosed(), "Sale has already ended");
        require(_newClosingTime > now, "ClosingTime not in the future");
        require(_newClosingTime > openingTime, "New offering is zero");
        require(_newClosingTime - openingTime <= MAXOFFERINGPERIOD, "New offering too long");

        emit ClosingTimeChange(closingTime, _newClosingTime);

        closingTime = _newClosingTime;
    }

    /// @dev Finalize, i.e. end token minting phase and enable token transfers
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
    function distributeTokens(
        uint tokenRemaining,
        address[] memory beneficiaries,
        uint[] memory amounts,
        bool isPublicSale
    )
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

            tokenRemaining = tokenRemaining.sub(amount);
            token.mint(beneficiary, amount);

            emit TokenDistribution(beneficiary, amount, isPublicSale);
        }

        return tokenRemaining;
    }

    /// @dev Forward invested ether to company wallet
    function forwardFunds() internal {
        companyWallet.transfer(address(this).balance);
    }

}
