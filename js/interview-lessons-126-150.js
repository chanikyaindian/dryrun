export const interviewLessons126to150 = {
  'reverse-bits': {
    bits: { names: ['number', 'reversed_bits'], width: 32 },
    variables: ['number', 'reversed_bits', 'bit', 'index'],
    output: '2684354560',
    code: `def reverse_bits(number):
    reversed_bits = 0
    for index in range(32):
        bit = number & 1
        reversed_bits = reversed_bits * 2 + bit  # Step: Append low bit | Shift the result left and append the next bit from the input.
        number = number // 2  # Step: Advance input | Drop the low bit so the next one can be read.
    return reversed_bits

print(reverse_bits(5))`,
  },
  'number-of-1-bits': {
    bits: { names: ['number'], width: 8 },
    variables: ['number', 'count'],
    output: '4',
    code: `def count_ones(number):
    count = 0
    while number:
        number = number & (number - 1)  # Step: Clear lowest set bit | Subtracting one flips the lowest set bit and the bits below it. AND clears just that set bit.
        count += 1  # Step: Count cleared bit | Each pass removes exactly one set bit.
    return count

print(count_ones(45))`,
  },
  'single-number': {
    bits: { names: ['value', 'single'], width: 8 },
    variables: ['nums', 'value', 'single'],
    output: '6',
    code: `def single_number(nums):
    single = 0
    for value in nums:
        single = single ^ value  # Step: XOR next value | Equal values cancel in pairs. The unpaired value remains.
    return single

print(single_number([5, 2, 5, 6, 2]))`,
  },
  'single-number-ii': {
    bits: { names: ['value', 'ones', 'twos'], width: 8 },
    variables: ['value', 'ones', 'twos'],
    output: '6',
    code: `def single_among_triples(nums):
    ones, twos = 0, 0
    for value in nums:
        ones = (ones ^ value) & ~twos  # Step: Update once mask | Keep bits seen once modulo three, excluding bits already seen twice.
        twos = (twos ^ value) & ~ones  # Step: Update twice mask | Track the second occurrence. The third clears the bit from both masks.
    return ones

print(single_among_triples([3, 3, 6, 3]))`,
  },
  'bitwise-and-of-numbers-range': {
    bits: { names: ['left', 'right', 'result'], width: 8 },
    variables: ['left', 'right', 'shift', 'result'],
    output: '8',
    code: `def range_and(left, right):
    shift = 0
    while left != right:
        shift += 1
        left, right = left >> 1, right >> 1  # Step: Strip low positions | At least one value in the range clears each position below the common prefix.
    result = left << shift  # Step: Restore shared prefix | Shift the common prefix back and leave the stripped positions zero.
    return result

print(range_and(10, 13))`,
  },
  'palindrome-number': {
    variables: ['number', 'reversed_half', 'digit'],
    output: 'True\nFalse',
    code: `def is_palindrome(number):
    if number < 0 or (number != 0 and number % 10 == 0):
        return False
    reversed_half = 0
    while number > reversed_half:
        digit = number % 10
        reversed_half = reversed_half * 10 + digit  # Step: Append last digit | Build the reversed half from the low digits.
        number //= 10  # Step: Trim original | Stop when the reversed half meets or passes the remaining prefix.
    return number == reversed_half or number == reversed_half // 10

print(is_palindrome(12321))
print(is_palindrome(12341))`,
  },
  'plus-one': {
    variables: ['digits', 'index'],
    output: '[1, 0, 0, 0]\n[1, 3, 0]',
    code: `def plus_one(digits):
    for index in range(len(digits) - 1, -1, -1):
        if digits[index] < 9:
            digits[index] += 1  # Step: Absorb carry | This digit can increase without another carry.
            return digits
        digits[index] = 0  # Step: Carry left | Nine plus one becomes zero and carries into the next digit.
    result = [1] + digits  # Step: Grow number | An extra leading digit is needed when every original digit was nine.
    return result

print(plus_one([9, 9, 9]))
print(plus_one([1, 2, 9]))`,
  },
  'factorial-trailing-zeroes': {
    variables: ['number', 'count'],
    output: '7',
    code: `def trailing_zeroes(number):
    count = 0
    while number:
        number //= 5
        count += number  # Step: Count factors of five | Multiples of each power of five contribute another zero.
    return count

print(trailing_zeroes(30))`,
  },
  'sqrtx': {
    variables: ['number', 'low', 'high', 'mid', 'best'],
    output: '7',
    code: `def integer_sqrt(number):
    low, high = 1, number
    best = 0
    while low <= high:
        mid = (low + high) // 2  # Step: Probe square root | Compare the candidate with the quotient to avoid squaring it.
        if mid <= number // mid:
            best = mid  # Step: Keep valid candidate | This value fits. Search the larger half for a better one.
            low = mid + 1
        else:
            high = mid - 1  # Step: Discard large candidates | This candidate and all larger ones are too large.
    return best

print(integer_sqrt(58))`,
  },
  'powx-n': {
    variables: ['base', 'power', 'result'],
    output: '0.125\n243',
    code: `def fast_power(base, power):
    if power < 0:
        base = 1 / base  # Step: Invert base | A negative exponent is the corresponding positive power of the reciprocal.
        power = -power
    result = 1
    while power:
        if power % 2:
            result *= base  # Step: Multiply selected power | Include this squared base when the current exponent bit is one.
        base *= base  # Step: Square base | One square advances to the next power of two.
        power //= 2
    return result

print(fast_power(2, -3))
print(fast_power(3, 5))`,
  },
  'max-points-on-a-line': {
    variables: ['points', 'anchor', 'other', 'dx', 'dy', 'key', 'counts', 'best'],
    output: '4',
    code: `def gcd(left, right):
    while right:
        left, right = right, left % right
    return left

def max_points(points):
    best = 1
    for anchor in range(len(points)):
        counts = {}
        for other in range(anchor + 1, len(points)):
            dx = points[other][0] - points[anchor][0]
            dy = points[other][1] - points[anchor][1]
            divisor = gcd(abs(dx), abs(dy))
            dx, dy = dx // divisor, dy // divisor
            if dx < 0 or (dx == 0 and dy < 0):
                dx, dy = -dx, -dy
            key = str(dy) + "/" + str(dx)  # Step: Normalize direction | Reduce the differences to the same exact key for collinear points.
            counts[key] = counts.get(key, 0) + 1
            best = max(best, counts[key] + 1)  # Step: Count aligned points | Include the anchor in this slope's count.
    return best

print(max_points([[0, 0], [1, 1], [2, 2], [-1, -1], [1, 3]]))`,
  },
  'climbing-stairs': {
    variables: ['step', 'previous', 'current'],
    output: '8',
    code: `def ways(n):
    previous, current = 1, 1
    for step in range(2, n + 1):
        previous, current = current, previous + current  # Step: Combine arrivals | Each way reaches this step from one or two steps below.
    return current

print(ways(5))`,
  },
  'house-robber': {
    variables: ['houses', 'amount', 'take', 'skip'],
    output: '12',
    code: `def rob(houses):
    take, skip = 0, 0
    for amount in houses:
        take, skip = skip + amount, max(take, skip)  # Step: Compare take and skip | Taking this house requires skipping the last. Skipping preserves the better previous total.
    return max(take, skip)

print(rob([2, 7, 9, 3, 1]))`,
  },
  'word-break': {
    variables: ['text', 'start', 'end', 'word', 'reachable'],
    output: 'True\nFalse',
    code: `def word_break(text, words):
    reachable = [False] * (len(text) + 1)
    reachable[0] = True
    for end in range(1, len(text) + 1):
        for word in words:
            start = end - len(word)
            if start >= 0 and reachable[start] and text[start:end] == word:
                reachable[end] = True  # Step: Extend valid prefix | Append a dictionary word to a prefix that was already segmentable.
                break
    return reachable[-1]

print(word_break("dryrun", ["dry", "run", "rune"]))
print(word_break("dryruns", ["dry", "run", "rune"]))`,
  },
  'coin-change': {
    variables: ['coins', 'target', 'amount', 'coin', 'fewest'],
    output: '3\n-1',
    code: `def coin_change(coins, target):
    impossible = target + 1
    fewest = [impossible] * (target + 1)
    fewest[0] = 0
    for amount in range(1, target + 1):
        for coin in coins:
            if coin <= amount and fewest[amount - coin] + 1 < fewest[amount]:
                fewest[amount] = fewest[amount - coin] + 1  # Step: Improve coin count | Compare with one extra coin added to the best solution for the smaller amount.
    return -1 if fewest[target] == impossible else fewest[target]

print(coin_change([1, 2, 5], 11))
print(coin_change([2], 3))`,
  },
  'longest-increasing-subsequence': {
    variables: ['nums', 'value', 'tails', 'low', 'high', 'mid'],
    output: '4',
    code: `def longest_increasing(nums):
    tails = []
    for value in nums:
        low, high = 0, len(tails)
        while low < high:
            mid = (low + high) // 2
            if tails[mid] < value:
                low = mid + 1
            else:
                high = mid
        if low == len(tails):
            tails.append(value)  # Step: Extend longest length | This value is larger than every existing tail.
        else:
            tails[low] = value  # Step: Lower a tail | A smaller last value leaves more room to extend a subsequence of this length.
    return len(tails)

print(longest_increasing([10, 9, 2, 5, 3, 7, 101, 18]))`,
  },
  'triangle': {
    grid: 'triangle',
    variables: ['triangle', 'best', 'row', 'col'],
    output: '11',
    code: `def minimum_total(triangle):
    best = triangle[-1].copy()
    for row in range(len(triangle) - 2, -1, -1):
        for col in range(row + 1):
            best[col] = triangle[row][col] + min(best[col], best[col + 1])  # Step: Fold next row | Add the cheaper of the two adjacent routes below.
    return best[0]

print(minimum_total([[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]))`,
  },
  'minimum-path-sum': {
    grid: 'cost',
    variables: ['cost', 'row', 'col'],
    output: '7',
    code: `def min_path(cost):
    rows, cols = len(cost), len(cost[0])
    for row in range(rows):
        for col in range(cols):
            if row == 0 and col == 0:
                continue
            if row == 0:
                cost[row][col] += cost[row][col - 1]  # Step: Arrive from left | Along the top row, only the previous column can lead here.
            elif col == 0:
                cost[row][col] += cost[row - 1][col]  # Step: Arrive from above | Along the first column, only the previous row can lead here.
            else:
                cost[row][col] += min(cost[row - 1][col], cost[row][col - 1])  # Step: Save cheapest arrival | Add the cell cost to the cheaper reachable neighbor.
    return cost[-1][-1]

print(min_path([[1, 3, 1], [1, 5, 1], [4, 2, 1]]))`,
  },
  'unique-paths-ii': {
    grid: 'paths',
    variables: ['paths', 'row', 'col'],
    output: '2',
    code: `def count_paths(obstacles):
    rows, cols = len(obstacles), len(obstacles[0])
    paths = [[0] * cols for _ in range(rows)]
    paths[0][0] = 1
    for row in range(rows):
        for col in range(cols):
            if obstacles[row][col]:
                paths[row][col] = 0  # Step: Block path | An obstacle permits no routes through this cell.
            elif row or col:
                paths[row][col] = (paths[row - 1][col] if row else 0) + (paths[row][col - 1] if col else 0)  # Step: Add routes | Every arrival comes from above or the left.
    return paths[-1][-1]

print(count_paths([[0, 0, 0], [0, 1, 0], [0, 0, 0]]))`,
  },
  'longest-palindromic-substring': {
    variables: ['text', 'center', 'left', 'right', 'best'],
    output: 'abba',
    code: `def longest_palindrome(text):
    best = ""
    for center in range(len(text)):
        for right_start in [center, center + 1]:
            left, right = center, right_start
            while left >= 0 and right < len(text) and text[left] == text[right]:
                if right - left + 1 > len(best):
                    best = text[left:right + 1]  # Step: Save longer palindrome | Matching characters at both ends preserve the palindrome.
                left -= 1
                right += 1  # Step: Expand around center | Try one more character on each side.
    return best

print(longest_palindrome("cabbad"))`,
  },
  'interleaving-string': {
    grid: 'possible',
    variables: ['possible', 'first', 'second', 'target', 'row', 'col', 'letter'],
    output: 'True\nFalse',
    code: `def interleaves(first, second, target):
    m, n = len(first), len(second)
    if len(target) != m + n:
        return False
    possible = [[False] * (n + 1) for _ in range(m + 1)]
    possible[0][0] = True
    for row in range(m + 1):
        for col in range(n + 1):
            if row == 0 and col == 0:
                continue
            letter = target[row + col - 1]
            from_first = row > 0 and possible[row - 1][col] and first[row - 1] == letter
            from_second = col > 0 and possible[row][col - 1] and second[col - 1] == letter
            possible[row][col] = from_first or from_second  # Step: Test prefix match | This prefix works if either previous state can supply the next letter.
    return possible[m][n]

print(interleaves("ab", "cd", "acbd"))
print(interleaves("ab", "cd", "adbc"))`,
  },
  'edit-distance': {
    grid: 'distance',
    variables: ['distance', 'first', 'second', 'row', 'col'],
    output: '2',
    code: `def edit_distance(first, second):
    rows, cols = len(first) + 1, len(second) + 1
    distance = [[0] * cols for _ in range(rows)]
    for row in range(rows):
        distance[row][0] = row
    for col in range(cols):
        distance[0][col] = col
    for row in range(1, rows):
        for col in range(1, cols):
            if first[row - 1] == second[col - 1]:
                distance[row][col] = distance[row - 1][col - 1]  # Step: Keep matching letters | Matching final characters need no extra edit.
            else:
                distance[row][col] = 1 + min(distance[row - 1][col], distance[row][col - 1], distance[row - 1][col - 1])  # Step: Choose cheapest edit | Add one to the cheapest deletion, insertion, or replacement.
    return distance[-1][-1]

print(edit_distance("cat", "cute"))`,
  },
  'best-time-to-buy-and-sell-stock-iii': {
    variables: ['price', 'hold_first', 'sold_first', 'hold_second', 'sold_second'],
    output: '6',
    code: `def profit_with_two(prices):
    hold_first = hold_second = -prices[0]
    sold_first = sold_second = 0
    for price in prices:
        sold_second = max(sold_second, hold_second + price)  # Step: Consider second sale | Compare a sale today with the best completed two-transaction profit.
        hold_second = max(hold_second, sold_first - price)  # Step: Consider second purchase | Spend today's price after the first sale.
        sold_first = max(sold_first, hold_first + price)
        hold_first = max(hold_first, -price)  # Step: Update first transaction | Keep the best first purchase cost and first sale profit.
    return sold_second

print(profit_with_two([3, 3, 5, 0, 0, 3, 1, 4]))`,
  },
  'best-time-to-buy-and-sell-stock-iv': {
    variables: ['price', 'transaction', 'hold', 'sold'],
    output: '7',
    code: `def profit_with_limit(k, prices):
    if not prices or k == 0:
        return 0
    if k >= len(prices) // 2:
        profit = 0
        for day in range(1, len(prices)):
            profit += max(0, prices[day] - prices[day - 1])  # Step: Take every rise | The transaction limit cannot bind on this input.
        return profit
    hold = [-prices[0]] * (k + 1)
    sold = [0] * (k + 1)
    for price in prices:
        for transaction in range(k, 0, -1):
            sold[transaction] = max(sold[transaction], hold[transaction] + price)  # Step: Consider sale | Compare selling today with keeping this transaction limit's previous best.
            hold[transaction] = max(hold[transaction], sold[transaction - 1] - price)  # Step: Consider purchase | Buy with the profit earned using one fewer completed transaction.
    return sold[k]

print(profit_with_limit(2, [3, 2, 6, 5, 0, 3]))`,
  },
  'maximal-square': {
    grid: 'sizes',
    variables: ['sizes', 'row', 'col', 'largest'],
    output: '4',
    code: `def maximal_square(matrix):
    rows, cols = len(matrix), len(matrix[0])
    sizes = [[0] * (cols + 1) for _ in range(rows + 1)]
    largest = 0
    for row in range(1, rows + 1):
        for col in range(1, cols + 1):
            if matrix[row - 1][col - 1] == "1":
                sizes[row][col] = 1 + min(sizes[row - 1][col], sizes[row][col - 1], sizes[row - 1][col - 1])  # Step: Grow a square | A one can extend the smallest neighboring square by one side length.
                largest = max(largest, sizes[row][col])
            else:
                continue  # Step: Keep zero | A square cannot end at a zero cell.
    return largest * largest

print(maximal_square([list("101"), list("111"), list("111")]))`,
  },
};
