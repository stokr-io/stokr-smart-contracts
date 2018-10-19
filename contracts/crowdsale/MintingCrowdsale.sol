pragma solidity 0.4.24;

import "../math/SafeMath.sol";
import "../ownership/Ownable.sol";
import "../token/MintableToken.sol";


/// @title MintingCrowdsale
/// @author SICOS
contract MintingCrowdsale is Ownable {
    using SafeMath for uint;

    // Ethereum address of rate setting authority
    address public rateAdmin;

    // The token to be sold
    MintableToken public token;

    // Token amounts
    uint public tokenCap;       // Maximum number of token units to deliver
    uint public tokenRemaining; // Remaining token units for sale

    // Integral token units (10^-18 tokens) per wei
    uint public tokenPrice;  // Token price in EUR cent per token
    uint public etherRate;   // Ether price in EUR cent per ether

    // Public sale period
    uint public openingTime;
    uint public closingTime;

    // Ethereum address where invested funds will be transferred to
    address public companyWallet;

    // Amount and receiver of revserved tokens.
    uint public tokenReserve;
    address public reserveAccount;

    // Wether this crowdsale was finalized or not
    bool public isFinalized = false;


    /// @dev Log entry upon token distribution event
    /// @param beneficiary Ethereum address of token recipient
    /// @param amount Number of token units
    event TokenDistribution(address indexed beneficiary, uint amount);

    /// @dev Log entry upon rate admin change event
    /// @param previous Previous Ethereum address of rate admin
    /// @param current Current Ethereum address of rate admin
    event RateAdminChange(address indexed previous, address indexed current);

    /// @dev Log entry upon rate change event
    /// @param previous Previous rate in EUR cent per Ether
    /// @param current Current rate in EUR cent per Ether
    event RateChange(uint previous, uint current);

    /// @dev Log entry upon token purchase event
    /// @param buyer Ethereum address of token purchaser
    /// @param value Worth in wei of purchased token amount
    /// @param amount Number of token units
    event TokenPurchase(address indexed buyer, uint value, uint amount);

    /// @dev Log entry upon finalization event
    event Finalization();


    /// @dev Constructor
    /// @param _token The token
    /// @param _tokenCap Maximum number of token units to create
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _etherRate Rate of an Ether in EUR cent
    /// @param _rateAdmin Ethereum address of ether rate setting authority
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _tokenReserve A number
    /// @param _reserveAccount An address
    constructor(
        MintableToken _token,
        uint _tokenCap,
        uint _tokenPrice,
        uint _etherRate,
        address _rateAdmin,
        uint _openingTime,
        uint _closingTime,
        address _companyWallet,
        uint _tokenReserve,
        address _reserveAccount
    )
        public
    {
        require(address(_token) != address(0x0), "Token address must not be zero");
        require(_tokenCap > 0, "Token cap must be greater than zero");
        require(_tokenPrice > 0, "Token price must be greater than zero");
        require(_etherRate > 0, "Ether price must be greater than zero");
        require(_rateAdmin != address(0x0), "Rate admin address must not be zero");
        require(_openingTime >= now, "Opening time must not lie in the past");
        require(_closingTime >= _openingTime, "Closing time must not lie before opening time");
        require(_companyWallet != address(0x0), "Company wallet address must not be zero");
        require(_tokenReserve <= _tokenCap, "Token reserve must not exceed token cap");
        require(_reserveAccount != address(0x0), "Reserve account address must not be zero");

        token = _token;
        tokenCap = _tokenCap;
        tokenPrice = _tokenPrice;
        etherRate = _etherRate;
        rateAdmin = _rateAdmin;
        openingTime = _openingTime;
        closingTime = _closingTime;
        companyWallet = _companyWallet;
        tokenReserve = _tokenReserve;
        reserveAccount = _reserveAccount;

        tokenRemaining = _tokenCap - _tokenReserve;
    }

    /// @dev Restrict operation to rate setting authority
    modifier onlyRateAdmin() {
        require(msg.sender == rateAdmin, "Operation is restricted to rate admin only");
        _;
    }

    /// @dev Fallback function: buys tokens
    function () public payable {
        buyTokens();
    }

    /// @dev Distribute presold tokens and bonus tokens to investors
    /// @param _beneficiaries List of recipients' Ethereum addresses
    /// @param _amounts List of token units each recipient will receive
    function distributeTokens(address[] _beneficiaries, uint[] _amounts) public onlyOwner {
        require(!isFinalized, "Token distribution is not possible after finalization");
        require(_beneficiaries.length == _amounts.length, "Arguments must have same length");

        uint newTokenRemaining = tokenRemaining;

        for (uint i = 0; i < _beneficiaries.length; ++i) {
            address beneficiary = _beneficiaries[i];
            uint amount = _amounts[i];

            require(amount <= newTokenRemaining, "Not enough tokens avaliable");

            newTokenRemaining -= amount;
            token.mint(beneficiary, amount);

            emit TokenDistribution(beneficiary, amount);
        }

        tokenRemaining = newTokenRemaining;
    }

    /// @dev Set rate admin, i.e. the ether rate setting authority
    /// @param _rateAdmin Ethereum address of new rate admin
    function setRateAdmin(address _rateAdmin) public onlyOwner {
        require(_rateAdmin != address(0x0), "Rate setter address must not be zero");

        if (_rateAdmin != rateAdmin) {
            emit RateAdminChange(rateAdmin, _rateAdmin);

            rateAdmin = _rateAdmin;
        }
    }

    /// @dev Set rate, i.e. adjust to changes of EUR/ether exchange rate
    /// @param _etherRate Rate in Euro cent per ether
    function setRate(uint _etherRate) public onlyRateAdmin {
        // Rate changes beyond an order of magnitude are likely just typos
        require(etherRate / 10 < _etherRate && _etherRate < 10 * etherRate,
                "Rate must not change by an order of magnitude or more");

        if (_etherRate != etherRate) {
            emit RateChange(etherRate, _etherRate);

            etherRate = _etherRate;
        }
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

    /// @dev Purchase tokens
    function buyTokens() public payable {
        require(isOpen(), "Token purchase is not possible if sale is not open");

        // Units:  [1e-18*ether] * [cent/ether] / [cent/token] => [1e-18*token]
        uint amount = msg.value.mul(etherRate).div(tokenPrice);

        require(amount <= tokenRemaining, "Not enough tokens for sale available");

        tokenRemaining -= amount;
        token.mint(msg.sender, amount);
        forwardFunds();

        emit TokenPurchase(msg.sender, msg.value, amount);
    }

    /// @dev Finalize, i.e. end token minting phase and enable token trading
    function finalize() public onlyOwner {
        require(!isFinalized, "Sale cannot get finalized again");
        require(hasClosed(), "Sale must have been closed prior to finalizing");

        token.mint(reserveAccount, tokenReserve);
        token.finishMinting();
        isFinalized = true;

        emit Finalization();
    }

    /// @dev Forward invested ether to company wallet
    function forwardFunds() internal {
        companyWallet.transfer(msg.value);
    }

}

