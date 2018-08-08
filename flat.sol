pragma solidity ^0.4.23;

// File: node_modules/zeppelin-solidity/contracts/math/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (a == 0) {
      return 0;
    }

    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

// File: node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipRenounced(address indexed previousOwner);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  constructor() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to relinquish control of the contract.
   * @notice Renouncing to ownership will leave the contract without an owner.
   * It will not be possible to call the functions with the `onlyOwner`
   * modifier anymore.
   */
  function renounceOwnership() public onlyOwner {
    emit OwnershipRenounced(owner);
    owner = address(0);
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function transferOwnership(address _newOwner) public onlyOwner {
    _transferOwnership(_newOwner);
  }

  /**
   * @dev Transfers control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function _transferOwnership(address _newOwner) internal {
    require(_newOwner != address(0));
    emit OwnershipTransferred(owner, _newOwner);
    owner = _newOwner;
  }
}

// File: node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * See https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

// File: node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20.sol

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender)
    public view returns (uint256);

  function transferFrom(address from, address to, uint256 value)
    public returns (bool);

  function approve(address spender, uint256 value) public returns (bool);
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
}

// File: node_modules/zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol

/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure.
 * To use this library you can add a `using SafeERC20 for ERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
  function safeTransfer(ERC20Basic token, address to, uint256 value) internal {
    require(token.transfer(to, value));
  }

  function safeTransferFrom(
    ERC20 token,
    address from,
    address to,
    uint256 value
  )
    internal
  {
    require(token.transferFrom(from, to, value));
  }

  function safeApprove(ERC20 token, address spender, uint256 value) internal {
    require(token.approve(spender, value));
  }
}

// File: node_modules/zeppelin-solidity/contracts/crowdsale/Crowdsale.sol

/**
 * @title Crowdsale
 * @dev Crowdsale is a base contract for managing a token crowdsale,
 * allowing investors to purchase tokens with ether. This contract implements
 * such functionality in its most fundamental form and can be extended to provide additional
 * functionality and/or custom behavior.
 * The external interface represents the basic interface for purchasing tokens, and conform
 * the base architecture for crowdsales. They are *not* intended to be modified / overriden.
 * The internal interface conforms the extensible and modifiable surface of crowdsales. Override
 * the methods to add functionality. Consider using 'super' where appropiate to concatenate
 * behavior.
 */
contract Crowdsale {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  // The token being sold
  ERC20 public token;

  // Address where funds are collected
  address public wallet;

  // How many token units a buyer gets per wei.
  // The rate is the conversion between wei and the smallest and indivisible token unit.
  // So, if you are using a rate of 1 with a DetailedERC20 token with 3 decimals called TOK
  // 1 wei will give you 1 unit, or 0.001 TOK.
  uint256 public rate;

  // Amount of wei raised
  uint256 public weiRaised;

  /**
   * Event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
  event TokenPurchase(
    address indexed purchaser,
    address indexed beneficiary,
    uint256 value,
    uint256 amount
  );

  /**
   * @param _rate Number of token units a buyer gets per wei
   * @param _wallet Address where collected funds will be forwarded to
   * @param _token Address of the token being sold
   */
  constructor(uint256 _rate, address _wallet, ERC20 _token) public {
    require(_rate > 0);
    require(_wallet != address(0));
    require(_token != address(0));

    rate = _rate;
    wallet = _wallet;
    token = _token;
  }

  // -----------------------------------------
  // Crowdsale external interface
  // -----------------------------------------

  /**
   * @dev fallback function ***DO NOT OVERRIDE***
   */
  function () external payable {
    buyTokens(msg.sender);
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public payable {

    uint256 weiAmount = msg.value;
    _preValidatePurchase(_beneficiary, weiAmount);

    // calculate token amount to be created
    uint256 tokens = _getTokenAmount(weiAmount);

    // update state
    weiRaised = weiRaised.add(weiAmount);

    _processPurchase(_beneficiary, tokens);
    emit TokenPurchase(
      msg.sender,
      _beneficiary,
      weiAmount,
      tokens
    );

    _updatePurchasingState(_beneficiary, weiAmount);

    _forwardFunds();
    _postValidatePurchase(_beneficiary, weiAmount);
  }

  // -----------------------------------------
  // Internal interface (extensible)
  // -----------------------------------------

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use super to concatenate validations.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    require(_beneficiary != address(0));
    require(_weiAmount != 0);
  }

  /**
   * @dev Validation of an executed purchase. Observe state and use revert statements to undo rollback when valid conditions are not met.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _postValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    // optional override
  }

  /**
   * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends its tokens.
   * @param _beneficiary Address performing the token purchase
   * @param _tokenAmount Number of tokens to be emitted
   */
  function _deliverTokens(
    address _beneficiary,
    uint256 _tokenAmount
  )
    internal
  {
    token.safeTransfer(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * @param _beneficiary Address receiving the tokens
   * @param _tokenAmount Number of tokens to be purchased
   */
  function _processPurchase(
    address _beneficiary,
    uint256 _tokenAmount
  )
    internal
  {
    _deliverTokens(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Override for extensions that require an internal state to check for validity (current user contributions, etc.)
   * @param _beneficiary Address receiving the tokens
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _updatePurchasingState(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    // optional override
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param _weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(uint256 _weiAmount)
    internal view returns (uint256)
  {
    return _weiAmount.mul(rate);
  }

  /**
   * @dev Determines how ETH is stored/forwarded on purchases.
   */
  function _forwardFunds() internal {
    wallet.transfer(msg.value);
  }
}

// File: node_modules/zeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol

/**
 * @title TimedCrowdsale
 * @dev Crowdsale accepting contributions only within a time frame.
 */
contract TimedCrowdsale is Crowdsale {
  using SafeMath for uint256;

  uint256 public openingTime;
  uint256 public closingTime;

  /**
   * @dev Reverts if not in crowdsale time range.
   */
  modifier onlyWhileOpen {
    // solium-disable-next-line security/no-block-members
    require(block.timestamp >= openingTime && block.timestamp <= closingTime);
    _;
  }

  /**
   * @dev Constructor, takes crowdsale opening and closing times.
   * @param _openingTime Crowdsale opening time
   * @param _closingTime Crowdsale closing time
   */
  constructor(uint256 _openingTime, uint256 _closingTime) public {
    // solium-disable-next-line security/no-block-members
    require(_openingTime >= block.timestamp);
    require(_closingTime >= _openingTime);

    openingTime = _openingTime;
    closingTime = _closingTime;
  }

  /**
   * @dev Checks whether the period in which the crowdsale is open has already elapsed.
   * @return Whether crowdsale period has elapsed
   */
  function hasClosed() public view returns (bool) {
    // solium-disable-next-line security/no-block-members
    return block.timestamp > closingTime;
  }

  /**
   * @dev Extend parent behavior requiring to be within contributing period
   * @param _beneficiary Token purchaser
   * @param _weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
    onlyWhileOpen
  {
    super._preValidatePurchase(_beneficiary, _weiAmount);
  }

}

// File: node_modules/zeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol

/**
 * @title FinalizableCrowdsale
 * @dev Extension of Crowdsale where an owner can do extra work
 * after finishing.
 */
contract FinalizableCrowdsale is TimedCrowdsale, Ownable {
  using SafeMath for uint256;

  bool public isFinalized = false;

  event Finalized();

  /**
   * @dev Must be called after crowdsale ends, to do some extra finalization
   * work. Calls the contract's finalization function.
   */
  function finalize() onlyOwner public {
    require(!isFinalized);
    require(hasClosed());

    finalization();
    emit Finalized();

    isFinalized = true;
  }

  /**
   * @dev Can be overridden to add finalization logic. The overriding function
   * should call super.finalization() to ensure the chain of finalization is
   * executed entirely.
   */
  function finalization() internal {
  }

}

// File: node_modules/zeppelin-solidity/contracts/payment/Escrow.sol

/**
 * @title Escrow
 * @dev Base escrow contract, holds funds destinated to a payee until they
 * withdraw them. The contract that uses the escrow as its payment method
 * should be its owner, and provide public methods redirecting to the escrow's
 * deposit and withdraw.
 */
contract Escrow is Ownable {
  using SafeMath for uint256;

  event Deposited(address indexed payee, uint256 weiAmount);
  event Withdrawn(address indexed payee, uint256 weiAmount);

  mapping(address => uint256) private deposits;

  function depositsOf(address _payee) public view returns (uint256) {
    return deposits[_payee];
  }

  /**
  * @dev Stores the sent amount as credit to be withdrawn.
  * @param _payee The destination address of the funds.
  */
  function deposit(address _payee) public onlyOwner payable {
    uint256 amount = msg.value;
    deposits[_payee] = deposits[_payee].add(amount);

    emit Deposited(_payee, amount);
  }

  /**
  * @dev Withdraw accumulated balance for a payee.
  * @param _payee The address whose funds will be withdrawn and transferred to.
  */
  function withdraw(address _payee) public onlyOwner {
    uint256 payment = deposits[_payee];
    assert(address(this).balance >= payment);

    deposits[_payee] = 0;

    _payee.transfer(payment);

    emit Withdrawn(_payee, payment);
  }
}

// File: node_modules/zeppelin-solidity/contracts/payment/ConditionalEscrow.sol

/**
 * @title ConditionalEscrow
 * @dev Base abstract escrow to only allow withdrawal if a condition is met.
 */
contract ConditionalEscrow is Escrow {
  /**
  * @dev Returns whether an address is allowed to withdraw their funds. To be
  * implemented by derived contracts.
  * @param _payee The destination address of the funds.
  */
  function withdrawalAllowed(address _payee) public view returns (bool);

  function withdraw(address _payee) public {
    require(withdrawalAllowed(_payee));
    super.withdraw(_payee);
  }
}

// File: node_modules/zeppelin-solidity/contracts/payment/RefundEscrow.sol

/**
 * @title RefundEscrow
 * @dev Escrow that holds funds for a beneficiary, deposited from multiple parties.
 * The contract owner may close the deposit period, and allow for either withdrawal
 * by the beneficiary, or refunds to the depositors.
 */
contract RefundEscrow is Ownable, ConditionalEscrow {
  enum State { Active, Refunding, Closed }

  event Closed();
  event RefundsEnabled();

  State public state;
  address public beneficiary;

  /**
   * @dev Constructor.
   * @param _beneficiary The beneficiary of the deposits.
   */
  constructor(address _beneficiary) public {
    require(_beneficiary != address(0));
    beneficiary = _beneficiary;
    state = State.Active;
  }

  /**
   * @dev Stores funds that may later be refunded.
   * @param _refundee The address funds will be sent to if a refund occurs.
   */
  function deposit(address _refundee) public payable {
    require(state == State.Active);
    super.deposit(_refundee);
  }

  /**
   * @dev Allows for the beneficiary to withdraw their funds, rejecting
   * further deposits.
   */
  function close() public onlyOwner {
    require(state == State.Active);
    state = State.Closed;
    emit Closed();
  }

  /**
   * @dev Allows for refunds to take place, rejecting further deposits.
   */
  function enableRefunds() public onlyOwner {
    require(state == State.Active);
    state = State.Refunding;
    emit RefundsEnabled();
  }

  /**
   * @dev Withdraws the beneficiary's funds.
   */
  function beneficiaryWithdraw() public {
    require(state == State.Closed);
    beneficiary.transfer(address(this).balance);
  }

  /**
   * @dev Returns whether refundees can withdraw their deposits (be refunded).
   */
  function withdrawalAllowed(address _payee) public view returns (bool) {
    return state == State.Refunding;
  }
}

// File: node_modules/zeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol

/**
 * @title RefundableCrowdsale
 * @dev Extension of Crowdsale contract that adds a funding goal, and
 * the possibility of users getting a refund if goal is not met.
 */
contract RefundableCrowdsale is FinalizableCrowdsale {
  using SafeMath for uint256;

  // minimum amount of funds to be raised in weis
  uint256 public goal;

  // refund escrow used to hold funds while crowdsale is running
  RefundEscrow private escrow;

  /**
   * @dev Constructor, creates RefundEscrow.
   * @param _goal Funding goal
   */
  constructor(uint256 _goal) public {
    require(_goal > 0);
    escrow = new RefundEscrow(wallet);
    goal = _goal;
  }

  /**
   * @dev Investors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(isFinalized);
    require(!goalReached());

    escrow.withdraw(msg.sender);
  }

  /**
   * @dev Checks whether funding goal was reached.
   * @return Whether funding goal was reached
   */
  function goalReached() public view returns (bool) {
    return weiRaised >= goal;
  }

  /**
   * @dev escrow finalization task, called when owner calls finalize()
   */
  function finalization() internal {
    if (goalReached()) {
      escrow.close();
      escrow.beneficiaryWithdraw();
    } else {
      escrow.enableRefunds();
    }

    super.finalization();
  }

  /**
   * @dev Overrides Crowdsale fund forwarding, sending funds to escrow.
   */
  function _forwardFunds() internal {
    escrow.deposit.value(msg.value)(msg.sender);
  }

}

// File: contracts/ProfitSharing.sol

/// @title ProfitSharing
/// @author Autogenerated from a Dia UML diagram
contract ProfitSharing is Ownable {

    using SafeMath for uint;

    struct InvestorAccount {
        uint balance;
        uint lastTotalProfits;
        uint profitShare;
    }

    mapping(address => InvestorAccount) public accounts;

    address public profitDepositor;
    uint public totalProfits;

    // As long as the total supply isn't fixed, i.e. new tokens can appear out of thin air,
    // the investors' profit shares aren't determined.
    bool public totalSupplyIsFixed;
    uint internal totalSupply_;

    event ProfitDepositorChanged(address newProfitDepositor);

    /// @dev Log entry on profit deposited
    /// @param depositor An Ethereum address
    /// @param amount A positive number
    event ProfitDeposited(address depositor, uint amount);

    /// @dev Log entry on profit share updated
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitShareUpdated(address investor, uint amount);

    /// @dev Log entry on profit withdrawal
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitWithdrawal(address investor, uint amount);

    /// @dev Ensure only depositor
    modifier onlyProfitDepositor() {
        require(msg.sender == profitDepositor, "Operation is restricted to profit depositor.");
        _;
    }

    /// @dev Constructor
    /// @param _profitDepositor An Ethereum address
    constructor(address _profitDepositor) public {
        setProfitDepositor(_profitDepositor);
    }

    /// @dev Change profit depositor
    /// @param _newProfitDepositor An Ethereum address
    function setProfitDepositor(address _newProfitDepositor) public onlyOwner {
        require(_newProfitDepositor != address(0x0), "Profit depositor address must not be zero.");

        if (profitDepositor != address(0x0) && _newProfitDepositor != profitDepositor) {
            emit ProfitDepositorChanged(_newProfitDepositor);
        }
        profitDepositor = _newProfitDepositor;
    }

    /// @dev Deposit profit
    function depositProfit() public payable onlyProfitDepositor {
        totalProfits = totalProfits.add(msg.value);

        emit ProfitDeposited(msg.sender, msg.value);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        if (!totalSupplyIsFixed || totalSupply_ == 0) {
            return 0;
        }
        return totalProfits.sub(accounts[_investor].lastTotalProfits)
                           .mul(accounts[_investor].balance)
                           .div(totalSupply_);  // <- The linter doesn't like this.
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        require(totalSupplyIsFixed, "Total supply must be fixed prior to update profit share.");

        uint additionalProfitShare =  profitShareOwing(_investor);

        accounts[_investor].lastTotalProfits = totalProfits;
        accounts[_investor].profitShare = accounts[_investor].profitShare.add(additionalProfitShare);

        emit ProfitShareUpdated(_investor, additionalProfitShare);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShare() public {
        updateProfitShare(msg.sender);

        uint withdrawnProfitShare = accounts[msg.sender].profitShare;

        accounts[msg.sender].profitShare = 0;
        msg.sender.transfer(withdrawnProfitShare);

        emit ProfitWithdrawal(msg.sender, withdrawnProfitShare);
    }

}

// File: contracts/Whitelist.sol

/// @title Whitelist
/// @author Autogenerated from a Dia UML diagram
contract Whitelist is Ownable {

    mapping(address => bool) public admins;
    mapping(address => bool) public isWhitelisted;

    /// @dev Log entry on admin added
    /// @param admin An Ethereum address
    event AdminAdded(address admin);

    /// @dev Log entry on admin removed
    /// @param admin An Ethereum address
    event AdminRemoved(address admin);

    /// @dev Log entry on investor added
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorAdded(address admin, address investor);

    /// @dev Log entry on investor removed
    /// @param admin An Ethereum address
    /// @param investor An Ethereum address
    event InvestorRemoved(address admin, address investor);

    /// @dev Only admin
    modifier onlyAdmin() {
        require(admins[msg.sender], "Operation is restricted to whitelist admin.");
        _;
    }

    /// @dev Add admin
    /// @param _admin An Ethereum address
    function addAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin address must not be zero.");

        if (!admins[_admin]) {
            admins[_admin] = true;

            emit AdminAdded(_admin);
        }
    }

    /// @dev Remove admin
    /// @param _admin An Ethereum address
    function removeAdmin(address _admin) public onlyOwner {
        require(_admin != address(0x0), "Whitelist admin address must not be zero.");

        if (admins[_admin]) {
            admins[_admin] = false;

            emit AdminRemoved(_admin);
        }
    }

    /// @dev Add to whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function addToWhitelist(address[] _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (!isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = true;

                emit InvestorAdded(msg.sender, _investors[i]);
            }
        }
    }

    /// @dev Remove from whitelist
    /// @param _investors A list where each entry is an Ethereum address
    function removeFromWhitelist(address[] _investors) public onlyAdmin {
        for (uint256 i = 0; i < _investors.length; i++) {
            if (isWhitelisted[_investors[i]]) {
                isWhitelisted[_investors[i]] = false;

                emit InvestorRemoved(msg.sender, _investors[i]);
            }
        }
    }

}

// File: contracts/Whitelisted.sol

/// @title Whitelisted
/// @author Autogenerated from a Dia UML diagram
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev Log entry on whitelist changed
    /// @param newWhitelist An Ethereum address
    event WhitelistChanged(address newWhitelist);

    /// @dev Ensure only whitelisted
    modifier onlyWhitelisted(address _address) {
        require(whitelist.isWhitelisted(_address), "Address must be whitelisted.");
        _;
    }

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    constructor(address _whitelist) public {
        setWhitelist(_whitelist);
    }

    /// @dev Set whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(address _newWhitelist) public onlyOwner {
        require(_newWhitelist != address(0x0), "Whitelist address must not be zero.");

        if (whitelist != address(0x0) && _newWhitelist != address(whitelist)) {
            emit WhitelistChanged(_newWhitelist);
        }
        whitelist = Whitelist(_newWhitelist);
    }

}

// File: contracts/MintableToken.sol

/// @title MintableToken
/// @author Autogenerated from a Dia UML diagram
/// @dev A mintable token is a token that can be minted
contract MintableToken is ERC20, ProfitSharing, Whitelisted {

    address public minter;
    uint public numberOfInvestors = 0;

    /// @dev Log entry on mint
    /// @param to An Ethereum address
    /// @param amount A positive number
    event Minted(address to, uint amount);

    /// @dev Log entry on mint finished
    event MintFinished();

    /// @dev Ensure only minter
    modifier onlyMinter() {
        require(msg.sender == minter);
        _;
    }

    /// @dev Ensure can mint
    modifier canMint() {
        require(!totalSupplyIsFixed);
        _;
    }

    /// @dev Ensure not minting
    modifier notMinting() {
        require(totalSupplyIsFixed);
        _;
    }

    /// @dev Set minter
    /// @param _minter An Ethereum address
    function setMinter(address _minter) public onlyOwner {
        require(minter == address(0x0), "Minter may only be set once.");
        require(_minter != address(0x0), "Minter address must not be zero.");

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

// File: contracts/KeyRecoverable.sol

/// @title KeyRecoverable
/// @author Autogenerated from a Dia UML diagram
contract KeyRecoverable is Ownable {

    address public keyRecoverer;

    /// @dev Log entry on key recoverer changed
    /// @param newKeyRecoverer An Ethereum address
    event KeyRecovererChanged(address newKeyRecoverer);

    /// @dev Log entry on key recovered
    /// @param oldAddress An Ethereum address
    /// @param newAddress An Ethereum address
    event KeyRecovered(address oldAddress, address newAddress);

    /// @dev Ensure only key recoverer
    modifier onlyKeyRecoverer() {
        require(msg.sender == keyRecoverer, "Operation is restricted to key recoverer.");
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
        require(_newKeyRecoverer != address(0x0), "Key recoverer address must not be zero.");

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

// File: contracts/SicosToken.sol

/// @title SicosToken
/// @author Autogenerated from a Dia UML diagram
contract SicosToken is MintableToken, KeyRecoverable {

    mapping(address => mapping(address => uint)) internal allowance_;

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    /// @param _keyRecoverer An Ethereum address
    constructor(address _whitelist, address _profitDepositor, address _keyRecoverer)
        public
        Whitelisted(_whitelist)
        ProfitSharing(_profitDepositor)
        KeyRecoverable(_keyRecoverer)
    {}

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
                "New account address must not be an already existing account.");

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
        require(_value <= allowance_[_from][msg.sender], "Amount to transfer must not exceed allowance.");

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
        require(_to != address(0x0), "Recipient address must not be zero.");
        require(_value <= accounts[_from].balance, "Amount to transfer must not exceed balance.");

        updateProfitShare(_from);
        updateProfitShare(_to);

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        accounts[_to].balance = accounts[_to].balance.add(_value);

        emit Transfer(_from, _to, _value);

        return true;
    }

}

// File: contracts/SicosCrowdsale.sol

/// @title SicosCrowdsale
/// @author Autogenerated from a Dia UML diagram
contract SicosCrowdsale is RefundableCrowdsale {

    uint public tokenCap;
    uint public tokenRemaining;

    address public teamAccount;
    uint public teamShare;

    /// @dev Log entry on rate changed
    /// @param oldRate A positive number
    /// @param newRate A positive number
    event RateChanged(uint oldRate, uint newRate);

    /// @dev Constructor
    /// @param _token Address of token contract
    /// @param _tokenCap Maximum amount of token (sale + share)
    /// @param _tokenGoal Minimum amount of sold tokens for a successful sale
    /// @param _openingTime Unix timestamp of crowdsale opening
    /// @param _closingTime Unix timestamp of crowdsale closing
    /// @param _rate Tokens per ether rate
    /// @param _wallet Multisig wallet for receiving invested ether
    constructor(SicosToken _token,
                uint _tokenCap,
                uint _tokenGoal,
                uint _openingTime,
                uint _closingTime,
                uint _rate,
                uint _teamShare,
                address _wallet)
        public
        RefundableCrowdsale(_tokenGoal)
        TimedCrowdsale(_openingTime, _closingTime)
        Crowdsale(_rate, _wallet, _token)
    {
        require(_teamShare <= _tokenCap, "Team share must not exceed token cap.");
        require(_tokenGoal <= _tokenCap - _teamShare, "Goal must be attainable.");

        tokenCap = _tokenCap;
        teamShare = _teamShare;
        tokenRemaining = _tokenCap - _teamShare;
    }

    /// @dev Distribute tokens.
    /// @param _accounts List of Ethereum addresses who will receive tokens
    /// @param _amounts List of token amounts per account
    function distributeTokens(address[] _accounts, uint[] _amounts) public onlyOwner {
        require(_accounts.length == _amounts.length, "Number of accounts and amounts must be equal.");

        for (uint i = 0; i < _accounts.length; ++i) {
            _deliverTokens(_accounts[i], _amounts[i]);
        }
    }

    /// @dev Set rate
    /// @param _newRate A positive number
    function setRate(uint _newRate) public onlyOwner {
        // A rate change by an order of magnitude (or more) is likely a typo instead of intention
        // Note, this implicitly ensures the new rate cannot be set to zero
        require(rate / 10 < _newRate && _newRate < 10 * rate, "Rate change must be less than an order of magnitude.");

        if (_newRate != rate) {
            emit RateChanged(rate, _newRate);
        }
        rate = _newRate;
    }

    /// @dev Set team account
    /// @param _teamAccount An Ethereum address.
    function setTeamAccount(address _teamAccount) public onlyOwner {
        require(_teamAccount != address(0x0), "Team account address must not be zero.");

        teamAccount = _teamAccount;
    }

    /// @dev Time remaining of open crowdsale.
    /// @return Duration in seconds, or 0 if crowdsale has ended.
    function timeRemaining() public view returns (uint) {
        if (now >= closingTime) {
            return 0;
        }

        return closingTime - now;
    }

    /// @dev Overridden RefundableCrowdsale.goalReached().
    /// @return Whether the desired token amount was sold or not
    function goalReached() public view returns (bool) {
        return tokenCap - teamShare - tokenRemaining >= goal;
    }

    /// @dev Extend parent behavior requiring beneficiary to be identical to msg.sender
    /// @param _beneficiary Token purchaser
    /// @param _weiAmount Amount of wei contributed
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        require(_beneficiary == msg.sender, "Message sender and beneficiary address must be the same.");

        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    /// @dev Extend parent behavior by minting a tokens for the benefit of beneficiary.
    /// @param _beneficiary Token recipient
    /// @param _tokenAmount Token amount
    function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
        require(tokenRemaining >= _tokenAmount, "Amount of tokens to deliver exceeds remaining amount.");

        tokenRemaining -= _tokenAmount;

        SicosToken(token).mint(_beneficiary, _tokenAmount);
    }

    /// @dev Extend parent behavior to finish the token minting.
    function finalization() internal {
        super.finalization();

        if (goalReached()) {
            require(teamAccount != address(0x0), "Team account has to be set prior to finalization.");

            SicosToken(token).mint(teamAccount, teamShare);
            SicosToken(token).finishMinting();
        }
        else {
            SicosToken(token).destruct();
        }
    }

}
