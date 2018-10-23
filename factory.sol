pragma solidity 0.4.24;

// File: contracts/ownership/Ownable.sol

/// @title Ownable
/// @dev Provide a simple access control with a single authority: the owner
contract Ownable {

    // Ethreum address of current owner
    address public owner;

    // @dev Log event on ownership transferred
    // @param previousOwner Ethereum address of previous owner
    // @param newOwner Ethereum address of new owner
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @dev Forbid call by anyone but owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Restricted to owner");
        _;
    }

    /// @dev Deployer account becomes initial owner
    constructor() public {
        owner = msg.sender;
    }

    /// @dev Transfer ownership to a new Ethereum account
    /// @param _newOwner Ethereum address to transfer ownership to
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0x0), "New owner is zero");

        owner = _newOwner;

        emit OwnershipTransferred(owner, _newOwner);
    }

}

// File: contracts/recovery/KeyRecoverable.sol

/// @title KeyRecoverable
/// @author Autogenerated from a Dia UML diagram
contract KeyRecoverable is Ownable {

    address public keyRecoverer;

    /// @dev Log entry on key recoverer changed
    /// @param newKeyRecoverer An Ethereum address
    event KeyRecovererChanged(address indexed newKeyRecoverer);

    /// @dev Log entry on key recovered
    /// @param oldAddress An Ethereum address
    /// @param newAddress An Ethereum address
    event KeyRecovered(address indexed oldAddress, address indexed newAddress);

    /// @dev Ensure only key recoverer:w
    modifier onlyKeyRecoverer() {
        require(msg.sender == keyRecoverer, "Restricted to key recoverer");
        _;
    }

    /// @dev Constructor
    /// @param _keyRecoverer An Ethereum address
    constructor(address _keyRecoverer) public {
        setKeyRecoverer(_keyRecoverer);
    }

    /// @dev Set key recoverer
    /// @param _newKeyRecoverer An Ethereum address
    function setKeyRecoverer(address _newKeyRecoverer) public onlyOwner {
        require(_newKeyRecoverer != address(0x0), "New key recoverer is zero");

        if (keyRecoverer != address(0x0) && _newKeyRecoverer != keyRecoverer) {
            emit KeyRecovererChanged(_newKeyRecoverer);
        }
        keyRecoverer = _newKeyRecoverer;
    }

    /// @dev Recover key
    /// @param _oldAddress An Ethereum address
    /// @param _newAddress An Ethereum address
    function recoverKey(address _oldAddress, address _newAddress) public;

}

// File: contracts/whitelist/Whitelist.sol

/// @title Whitelist
/// @author Autogenerated from a Dia UML diagram
contract Whitelist is Ownable {

    mapping(address => bool) public admins;
    mapping(address => bool) public isWhitelisted;

    /// @dev Log entry on admin added
    /// @param admin An Ethereum address
    event AdminAdded(address indexed admin);

    /// @dev Log entry on admin removed
    /// @param admin An Ethereum address
    event AdminRemoved(address indexed admin);

    /// @dev Log entry on investor added
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorAdded(address indexed admin, address indexed investor);

    /// @dev Log entry on investor removed
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorRemoved(address indexed admin, address indexed investor);

    /// @dev Only admin
    modifier onlyAdmin() {
        require(admins[msg.sender], "Restricted to whitelist admin");
        _;
    }

    /// @dev Add admin
    /// @param _admin An Ethereum address
    function addAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin is zero");

        if (!admins[_admin]) {
            admins[_admin] = true;

            emit AdminAdded(_admin);
        }
    }

    /// @dev Remove admin
    /// @param _admin An Ethereum address
    function removeAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin is zero");  // Necessary?

        if (admins[_admin]) {
            admins[_admin] = false;

            emit AdminRemoved(_admin);
        }
    }

    /// @dev Add to whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function addToWhitelist(address[] memory _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (!isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = true;

                emit InvestorAdded(msg.sender, _investors[i]);
            }
        }
    }

    /// @dev Remove from whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function removeFromWhitelist(address[] memory _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = false;

                emit InvestorRemoved(msg.sender, _investors[i]);
            }
        }
    }

}

// File: contracts/whitelist/Whitelisted.sol

/// @title Whitelisted
/// @author Autogenerated from a Dia UML diagram
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev Log entry on whitelist changed
    /// @param newWhitelist An Ethereum address
    event WhitelistChanged(address indexed newWhitelist);

    /// @dev Ensure only whitelisted
    modifier onlyWhitelisted(address _address) {
        require(whitelist.isWhitelisted(_address), "Address is not whitelisted");
        _;
    }

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    constructor(Whitelist _whitelist) public {
        setWhitelist(_whitelist);
    }

    /// @dev Set whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(Whitelist _newWhitelist) public onlyOwner {
        require(address(_newWhitelist) != address(0x0), "Whitelist address is zero");

        if (address(whitelist) != address(0x0) && address(_newWhitelist) != address(whitelist)) {
            emit WhitelistChanged(address(_newWhitelist));
        }
        whitelist = Whitelist(_newWhitelist);
    }

}

// File: contracts/token/ERC20.sol

/// @title ERC20 interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
interface ERC20 {

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    function totalSupply() external view returns (uint);
    function balanceOf(address _owner) external view returns (uint);
    function allowance(address _owner, address _spender) external view returns (uint);
    function approve(address _spender, uint _value) external returns (bool);
    function transfer(address _to, uint _value) external returns (bool);
    function transferFrom(address _from, address _to, uint _value) external returns (bool);

}

// File: contracts/math/SafeMath.sol

/// @title SafeMath
/// @dev Math operations with safety checks that throw on error
library SafeMath {

    /// @dev Add two integers
    function add(uint a, uint b) internal pure returns (uint) {
        uint c = a + b;

        assert(c >= a);

        return c;
    }

    /// @dev Subtract two integers
    function sub(uint a, uint b) internal pure returns (uint) {
        assert(b <= a);

        return a - b;
    }

    /// @dev Multiply tow integers
    function mul(uint a, uint b) internal pure returns (uint) {
        if (a == 0) {
            return 0;
        }

        uint c = a * b;

        assert(c / a == b);

        return c;
    }

    /// @dev Floor divide two integers
    function div(uint a, uint b) internal pure returns (uint) {
        return a / b;
    }

}

// File: contracts/token/ProfitSharing.sol

/// @title ProfitSharing
/// @author Autogenerated from a Dia UML diagram
contract ProfitSharing is Ownable {

    using SafeMath for uint;


    // An InvestorAccount object keeps track of the investor's
    // - balance: amount of tokens he/she holds (always up-to-date)
    // - profitShare: amount of wei this token owed him/her at the last update
    // - lastTotalProfits: determines when his/her profitShare was updated
    // Note, this construction requires:
    // - totalProfits to never decrease
    // - totalSupply to be fixed
    // - profitShare of all involved parties to get updated prior to any token transfer
    // - lastTotalProfits to be set to current totalProfits upon profitShare update
    struct InvestorAccount {
        uint balance;           // token balance
        uint lastTotalProfits;  // totalProfits [wei] at the time of last profit share update
        uint profitShare;       // profit share [wei] of last update
    }


    // Investor account database
    mapping(address => InvestorAccount) public accounts;

    // Authority who is allowed to deposit profits [wei] on this
    address public profitDepositor;

    // Authority who is allowed to distribute profit shares [wei] to investors
    // (so, that they don't need to withdraw it by themselves)
    address public profitDistributor;

    // Amount of total profits [wei] stored to this token
    // In contrast to the wei balance (which may be reduced due to profit share withdrawal)
    // this value will never decrease
    uint public totalProfits;

    // As long as the total supply isn't fixed, i.e. new tokens can appear out of thin air,
    // the investors' profit shares aren't determined
    bool public totalSupplyIsFixed;

    // Total amount of tokens
    uint internal totalSupply_;


    /// @dev Log entry on change of profit deposit authority
    /// @param newProfitDepositor New authority's address
    event ProfitDepositorChange(address indexed newProfitDepositor);

    /// @dev Log entry on change of profit distribution authority
    /// @param newProfitDistributor New authority's address
    event ProfitDistributorChange(address indexed newProfitDistributor);

    /// @dev Log entry on profit deposit
    /// @param depositor Profit depositor's address
    /// @param amount Deposited profits in wei
    event ProfitDeposit(address indexed depositor, uint amount);

    /// @dev Log entry on profit share update
    /// @param investor Investor's address
    /// @param amount New wei amount the token owes the investor
    event ProfitShareUpdate(address indexed investor, uint amount);

    /// @dev Log entry on profit withdrawal
    /// @param investor Investor's address
    /// @param amount Wei amount the investor withdrew from this token
    event ProfitShareWithdrawal(address indexed investor, address indexed beneficiary, uint amount);


    /// @dev Restrict operation to profit deposit authority only
    modifier onlyProfitDepositor() {
        require(msg.sender == profitDepositor, "Restricted to profit depositor");
        _;
    }

    /// @dev Restrict operation to profit distribution authority only
    modifier onlyProfitDistributor() {
        require(msg.sender == profitDepositor, "Restricted to profit distributor");
        _;
    }

    /// @dev Constructor
    /// @param _profitDepositor Profit deposit authority
    constructor(address _profitDepositor) public {
        setProfitDepositor(_profitDepositor);
    }

    /// @dev Profit deposit if possible via fallback function
    function() public payable {
        depositProfit();
    }

    /// @dev Change profit depositor
    /// @param _newProfitDepositor An Ethereum address
    function setProfitDepositor(address _newProfitDepositor) public onlyOwner {
        require(_newProfitDepositor != address(0x0), "New profit depositor is zero");

        // Don't emit event if set for first time or to the same value again
        if (profitDepositor != address(0x0) && _newProfitDepositor != profitDepositor) {
            emit ProfitDepositorChange(_newProfitDepositor);
        }
        profitDepositor = _newProfitDepositor;
    }

    /// @dev Change profit distributor
    /// @param _newProfitDistributor An Ethereum address
    function setProfitDistributor(address _newProfitDistributor) public onlyOwner {
        require(_newProfitDistributor != address(0x0), "New profit distributor is zero");

        // Don't emit event if set for first time or to the same value again
        if (profitDistributor != address(0x0) && _newProfitDistributor != profitDistributor) {
            emit ProfitDistributorChange(_newProfitDistributor);
        }
        profitDistributor = _newProfitDistributor;
    }

    /// @dev Deposit profit
    function depositProfit() public payable onlyProfitDepositor {
        totalProfits = totalProfits.add(msg.value);

        emit ProfitDeposit(msg.sender, msg.value);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        if (!totalSupplyIsFixed || totalSupply_ == 0) {
            return 0;
        }

        InvestorAccount memory account = accounts[_investor];

        return totalProfits.sub(account.lastTotalProfits)
                           .mul(account.balance)
                           .div(totalSupply_)
                           .add(account.profitShare);
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        require(totalSupplyIsFixed, "Total supply may change");

        uint newProfitShare = profitShareOwing(_investor);

        accounts[_investor].lastTotalProfits = totalProfits;
        accounts[_investor].profitShare = newProfitShare;

        emit ProfitShareUpdate(_investor, newProfitShare);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShare() public {
        _withdrawProfitShare(msg.sender, msg.sender);
    }

    function withdrawProfitShare(address _beneficiary) public {
        _withdrawProfitShare(msg.sender, _beneficiary);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShares(address[] _investors) public onlyProfitDistributor {
        for (uint i = 0; i < _investors.length; ++i) {
            _withdrawProfitShare(_investors[i], _investors[i]);
        }
    }

    /// @dev Withdraw profit share
    function _withdrawProfitShare(address _investor, address _beneficiary) internal {
        updateProfitShare(_investor);

        uint withdrawnProfitShare = accounts[_investor].profitShare;

        accounts[_investor].profitShare = 0;
        _beneficiary.transfer(withdrawnProfitShare);

        emit ProfitShareWithdrawal(_investor, _beneficiary, withdrawnProfitShare);
    }

}

// File: contracts/token/MintableToken.sol

/// @title MintableToken
/// @author Autogenerated from a Dia UML diagram
/// @dev A mintable token is a token that can be minted
contract MintableToken is ERC20, ProfitSharing, Whitelisted {

    address public minter;
    uint public numberOfInvestors = 0;

    /// @dev Log entry on mint
    /// @param to An Ethereum address
    /// @param amount A positive number
    event Minted(address indexed to, uint amount);

    /// @dev Log entry on mint finished
    event MintFinished();

    /// @dev Ensure only minter
    modifier onlyMinter() {
        require(msg.sender == minter, "Restricted to minter");
        _;
    }

    /// @dev Ensure can mint
    modifier canMint() {
        require(!totalSupplyIsFixed, "Total supply has been fixed");
        _;
    }

    /// @dev Ensure not minting
    modifier notMinting() {
        require(totalSupplyIsFixed, "Total supply may change");
        _;
    }

    /// @dev Set minter
    /// @param _minter An Ethereum address
    function setMinter(address _minter) public onlyOwner {
        require(minter == address(0x0), "Minter has already been set");
        require(_minter != address(0x0), "Minter is zero");

        minter = _minter;
    }

    /// @dev Mint
    /// @param _to An Ethereum address
    /// @param _amount A positive number
    function mint(address _to, uint _amount) public onlyMinter canMint onlyWhitelisted(_to) {
        if (accounts[_to].balance == 0) {
            numberOfInvestors++;
        }

        totalSupply_ = totalSupply_.add(_amount);
        accounts[_to].balance = accounts[_to].balance.add(_amount);

        emit Minted(_to, _amount);
        emit Transfer(address(0x0), _to, _amount);
    }

    /// @dev Finish minting
    function finishMinting() public onlyMinter canMint {
        totalSupplyIsFixed = true;

        emit MintFinished();
    }

    /// @dev Minting finished
    /// @return True or false
    function mintingFinished() public view returns (bool) {
        return totalSupplyIsFixed;
    }

}

// File: contracts/token/StokrToken.sol

/// @title StokrToken
/// @author Autogenerated from a Dia UML diagram
contract StokrToken is MintableToken, KeyRecoverable {

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    mapping(address => mapping(address => uint)) internal allowance_;

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    /// @param _keyRecoverer An Ethereum address
    constructor(
        string _name,
        string _symbol,
        Whitelist _whitelist,
        address _profitDepositor,
        address _keyRecoverer
    )
        public
        Whitelisted(_whitelist)
        ProfitSharing(_profitDepositor)
        KeyRecoverable(_keyRecoverer)
    {
        name = _name;
        symbol = _symbol;
    }

    /// @dev Self destruct
    function destruct() public onlyMinter {
        selfdestruct(owner);
    }

    /// @dev Recover key
    /// @param _oldAddress An Ethereum address
    /// @param _newAddress An Ethereum address
    function recoverKey(address _oldAddress, address _newAddress)
        public
        onlyKeyRecoverer
        onlyWhitelisted(_oldAddress)
        onlyWhitelisted(_newAddress)
    {
        // Ensure that new address is *not* an existing account.
        // Check for account.profitShare is not needed because of following implication:
        //   (account.lastTotalProfits == 0) ==> (account.profitShare == 0)
        require(accounts[_newAddress].balance == 0 && accounts[_newAddress].lastTotalProfits == 0,
                "New address exists already");

        updateProfitShare(_oldAddress);

        accounts[_newAddress] = accounts[_oldAddress];
        delete accounts[_oldAddress];

        emit KeyRecovered(_oldAddress, _newAddress);
    }

    /// @dev Total supply
    /// @return A positive number
    function totalSupply() public view returns (uint) {
        return totalSupply_;
    }

    /// @dev Balance of
    /// @param _investor An Ethereum address
    /// @return A positive number
    function balanceOf(address _investor) public view returns (uint) {
        return accounts[_investor].balance;
    }

    /// @dev Allowance
    /// @param _investor An Ethereum address
    /// @param _spender An Ethereum address
    /// @return A positive number
    function allowance(address _investor, address _spender) public view returns (uint) {
        return allowance_[_investor][_spender];
    }

    /// @dev Approve
    /// @param _spender An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function approve(address _spender, uint _value)
        public
        onlyWhitelisted(msg.sender)
        notMinting
        returns (bool)
    {
        allowance_[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @dev Transfer
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transfer(address _to, uint _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @dev Transfer from
    /// @param _from An Ethereum address
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        require(_value <= allowance_[_from][msg.sender], "Amount exceeds allowance");

        allowance_[_from][msg.sender] = allowance_[_from][msg.sender].sub(_value);

        return _transfer(_from, _to, _value);
    }

    /// @dev Transfer
    /// @param _from An Ethereum address
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function _transfer(address _from, address _to, uint _value)
        internal
        onlyWhitelisted(_from)
        onlyWhitelisted(_to)
        notMinting
        returns (bool)
    {
        require(_to != address(0x0), "Recipient is zero");
        require(_value <= accounts[_from].balance, "Amount exceeds balance");

        updateProfitShare(_from);
        updateProfitShare(_to);

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        accounts[_to].balance = accounts[_to].balance.add(_value);

        emit Transfer(_from, _to, _value);

        return true;
    }

}

// File: contracts/crowdsale/MintingCrowdsale.sol

/// @title MintingCrowdsale
/// @author SICOS
contract MintingCrowdsale is Ownable {
    using SafeMath for uint;

    // Ethereum address of rate setting authority
    address public rateAdmin;

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
    // The ether rate is actually a price, too, but it is called a rate here, because it
    // may deviate from the current Ether price since it won't get updated at real time
    // but at regular intervals by the rate admin authority
    uint public tokenPrice;
    uint public etherRate;

    // Public sale period
    uint public openingTime;
    uint public closingTime;

    // Ethereum address where invested funds will be transferred to
    address public companyWallet;

    // Amount and receiver of reserved tokens
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
    /// @param _token The token to be sold
    /// @param _tokenCapOfPublicSale Maximum number of token units to mint in public sale
    /// @param _tokenCapOfPrivateSale Maximum number of token units to mint in private sale
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _etherRate Rate of an Ether in EUR cent
    /// @param _rateAdmin Ethereum address of ether rate setting authority
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _tokenReserve Number of token units to mint for the benefit of reserve account
    /// @param _reserveAccount Ethereum address of reserve tokens recipient
    constructor(
        MintableToken _token,
        uint _tokenCapOfPublicSale,
        uint _tokenCapOfPrivateSale,
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
        require(address(_token) != address(0x0), "Token address is zero");
        require(_tokenCapOfPublicSale > 0, "Cap of public sale is zero");
        require(_tokenCapOfPrivateSale > 0, "Cap of private sale is zero");
        require(_tokenPrice > 0, "Token price is zero");
        require(_etherRate > 0, "Ether price is zero");
        require(_rateAdmin != address(0x0), "Rate admin is zero");
        require(_openingTime >= now, "Opening lies in the past");
        require(_closingTime >= _openingTime, "Closing lies before opening");
        require(_companyWallet != address(0x0), "Company wallet is zero");
        require(_reserveAccount != address(0x0), "Reserve account is zero");

        // Utilize safe math to ensure the sum of three token pools does't overflow
        _tokenReserve.add(_tokenCapOfPublicSale).add(_tokenCapOfPrivateSale);

        token = _token;
        tokenCapOfPublicSale = _tokenCapOfPublicSale;
        tokenCapOfPrivateSale = _tokenCapOfPrivateSale;
        tokenPrice = _tokenPrice;
        etherRate = _etherRate;
        rateAdmin = _rateAdmin;
        openingTime = _openingTime;
        closingTime = _closingTime;
        companyWallet = _companyWallet;
        tokenReserve = _tokenReserve;
        reserveAccount = _reserveAccount;

        tokenRemainingForPublicSale = _tokenCapOfPublicSale;
        tokenRemainingForPrivateSale = _tokenCapOfPrivateSale;
    }

    /// @dev Restrict operation to rate setting authority
    modifier onlyRateAdmin() {
        require(msg.sender == rateAdmin, "Restricted to rate admin");
        _;
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

    /// @dev Set rate admin, i.e. the ether rate setting authority
    /// @param _rateAdmin Ethereum address of new rate admin
    function setRateAdmin(address _rateAdmin) public onlyOwner {
        require(_rateAdmin != address(0x0), "New rate admin is zero");

        if (_rateAdmin != rateAdmin) {
            emit RateAdminChange(rateAdmin, _rateAdmin);

            rateAdmin = _rateAdmin;
        }
    }

    /// @dev Set rate, i.e. adjust to changes of EUR/ether exchange rate
    /// @param newRate Rate in Euro cent per ether
    function setRate(uint newRate) public onlyRateAdmin {
        // Rate changes beyond an order of magnitude are likely just typos
        require(etherRate / 10 < newRate && newRate < 10 * etherRate, "Rate change too big");

        if (newRate != etherRate) {
            emit RateChange(etherRate, newRate);

            etherRate = newRate;
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
        uint amount = msg.value.mul(etherRate).div(tokenPrice);

        require(amount <= tokenRemainingForPublicSale, "Not enough tokens available");

        tokenRemainingForPublicSale -= amount;
        token.mint(msg.sender, amount);
        forwardFunds();

        emit TokenPurchase(msg.sender, msg.value, amount);
    }

    /// @dev Finalize, i.e. end token minting phase and enable token trading
    function finalize() public onlyOwner {
        require(!isFinalized, "Sale has already been finalized");
        require(hasClosed(), "Sale has not closed");

        token.mint(reserveAccount, tokenReserve);
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
        require(!isFinalized, "Sale was finalized");
        require(beneficiaries.length == amounts.length, "Lengths are different");

        for (uint i = 0; i < beneficiaries.length; ++i) {
            address beneficiary = beneficiaries[i];
            uint amount = amounts[i];

            require(amount <= tokenRemaining, "Not enough tokens avaliable");

            tokenRemaining -= amount;
            token.mint(beneficiary, amount);

            emit TokenDistribution(beneficiary, amount);
        }

        return tokenRemaining;
    }

    /// @dev Forward invested ether to company wallet
    function forwardFunds() internal {
        companyWallet.transfer(msg.value);
    }

}

// File: contracts/crowdsale/StokrCrowdsale.sol

/// @title StokrCrowdsale
/// @author Autogenerated from a Dia UML diagram
contract StokrCrowdsale is MintingCrowdsale {

    // Soft cap in token units
    uint public tokenGoal;

    // As long as the goal is not reached funds of purchases are held back
    // and investments are assigned to investors here to enable a refunding
    // if the goal is missed upon finalization
    mapping(address => uint) public investments;


    // Log entry upon investor refund event
    event InvestorRefund(address indexed investor, uint value);


    /// @dev Constructor
    /// @param _token The token
    /// @param _tokenCapOfPublicSale Available token units for public sale
    /// @param _tokenCapOfPrivateSale Available token units for private sale
    /// @param _tokenGoal Minimum number of sold token units to be successful
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _etherRate Price of an Ether in EUR cent
    /// @param _rateAdmin Ethereum address of ether rate setting authority
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _tokenReserve A number
    /// @param _reserveAccount An address
    constructor(
        StokrToken _token,
        uint _tokenCapOfPublicSale,
        uint _tokenCapOfPrivateSale,
        uint _tokenGoal,
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
        MintingCrowdsale(
            _token,
            _tokenCapOfPublicSale,
            _tokenCapOfPrivateSale,
            _tokenPrice,
            _etherRate,
            _rateAdmin,
            _openingTime,
            _closingTime,
            _companyWallet,
            _tokenReserve,
            _reserveAccount
        )
    {
        require(_tokenGoal <= _tokenCapOfPublicSale + _tokenCapOfPrivateSale, "Goal is not attainable");

        tokenGoal = _tokenGoal;
    }

    /// @dev Wether the goal of sold tokens was reached or not
    /// @return True if the sale can be considered successful
    function goalReached() public view returns (bool) {
        return tokenSold() >= tokenGoal;
    }

    /// @dev Investors can claim refunds here if crowdsale was unsuccessful
    function distributeRefunds(address[] _investors) public onlyOwner {
        for (uint i = 0; i < _investors.length; ++i) {
            refundInvestor(_investors[i]);
        }
    }

    /// @dev Investors can claim refunds here if crowdsale was unsuccessful
    function claimRefund() public {
        refundInvestor(msg.sender);
    }

    /// @dev Refund an investor if the sale was not successful
    /// @param _investor Ethereum address of investor
    function refundInvestor(address _investor) internal {
        require(isFinalized, "Sale has not been finalized");
        require(!goalReached(), "Goal was reached");

        uint investment = investments[_investor];

        if (investment > 0) {
            investments[_investor] = 0;
            _investor.transfer(investment);

            emit InvestorRefund(_investor, investment);
        }
    }

    /// @dev Overwritten. Kill the token if goal was missed
    function finalize() public onlyOwner {
        super.finalize();

        if (!goalReached()) {
            StokrToken(token).destruct();
        }
    }

    /// @dev Overwritten. Funds are held back until goal was reached
    function forwardFunds() internal {
        if (goalReached()) {
            super.forwardFunds();
        }
        else {
            investments[msg.sender] = investments[msg.sender].add(msg.value);
        }
    }

}

// File: contracts/StokrProjectFactory.sol

contract StokrProjectFactory is Ownable {



  struct StokrProject {

    Whitelist whitelist;
    address stokrToken;
    address stokrCrowdsale;
    string projectName;
  }

Whitelist currentWhitelist;

StokrProject[] public projects;

constructor(address _whitelist) public {
  currentWhitelist=Whitelist(_whitelist);
}

  function createNewProject(
  string _name,
  string _symbol,
  address[5] _roles,
  //roles[0] = _profitDepositor,
  //roles[1] = _keyRecoverer,
  //roles[2] = _rateAdmin,
  //roles[3] = tokenOwner
  // roles[4] = crowdsaleOwner
  uint _tokenGoal,
  uint[2] _caps,
  //_caps[0] = _tokenCapOfPublicSale,
  //_caps[1] = _tokenCapOfPrivateSale,
  uint _tokenPrice,
  uint _etherRate,
  uint[2] _times,
  address[2] _wallets,
  // _wallets[0] = companyWallet
  // _wallets[1] = reserveAccount
  uint _tokenReserve
  ) public onlyOwner {

  StokrToken token = new StokrToken(_name,
                                    _symbol,
                                     currentWhitelist, _roles[0], _roles[1]);

  StokrCrowdsale crowdsale = new StokrCrowdsale(token,
                                               _caps[0],
                                               _caps[1],
                                               _tokenGoal,
                                               _tokenPrice,
                                               _etherRate,
                                               _roles[2],
                                               _times[0],
                                               _times[1],
                                               _wallets[0],
                                               _tokenReserve,
                                               _wallets[1]);
  projects.push(StokrProject(currentWhitelist,token,crowdsale,_name));
  token.setMinter(crowdsale);
  //currentWhitelist.addToWhitelist([address(this)];)
  token.transferOwnership(_roles[3]);
  crowdsale.transferOwnership(_roles[4]);
}
}
