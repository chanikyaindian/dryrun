import { interviewLessons26to50 } from './interview-lessons-26-50.js';
import { interviewLessons51to75 } from './interview-lessons-51-75.js';
import { interviewLessons76to100 } from './interview-lessons-76-100.js';
import { interviewLessons101to125 } from './interview-lessons-101-125.js';
import { interviewLessons126to150 } from './interview-lessons-126-150.js';

// Original teaching examples. Step comments describe executed lines, and
// each lesson declares the values to display at those checkpoints.
export const interviewLessons = {
  'merge-sorted-array': {
    variables: ['nums', 'other', 'left', 'right', 'write'],
    output: '[1, 2, 4, 5, 7, 8]',
    code: `def merge(nums, m, other):
    left = m - 1
    right = len(other) - 1
    write = len(nums) - 1
    while right >= 0:
        if left >= 0 and nums[left] > other[right]:
            nums[write] = nums[left]  # Step: Take from left | Put the larger remaining left value in the last open slot.
            left -= 1
        else:
            nums[write] = other[right]  # Step: Take from right | Fill the last open slot with the next value from the other array.
            right -= 1
        write -= 1

nums = [1, 5, 7, 0, 0, 0]
merge(nums, 3, [2, 4, 8])
print(nums)`,
  },
  'remove-element': {
    variables: ['nums', 'target', 'read', 'write'],
    output: '[4, 1, 2]',
    code: `def remove_element(nums, target):
    write = 0
    for read in range(len(nums)):
        if nums[read] == target:
            continue  # Step: Skip target | Leave the write position unchanged for a removed value.
        nums[write] = nums[read]  # Step: Keep value | Move the retained value into the next slot of the result prefix.
        write += 1
    return write

nums = [4, 3, 1, 3, 2]
size = remove_element(nums, 3)
print(nums[:size])`,
  },
  'remove-duplicates-from-sorted-array': {
    variables: ['nums', 'read', 'write'],
    output: '[1, 2, 5]',
    code: `def deduplicate(nums):
    write = 0
    for read in range(len(nums)):
        if write > 0 and nums[read] == nums[write - 1]:
            continue  # Step: Skip duplicate | This value matches the last retained value.
        nums[write] = nums[read]  # Step: Keep unique value | Add a new distinct value to the result prefix.
        write += 1
    return write

nums = [1, 1, 2, 2, 2, 5]
size = deduplicate(nums)
print(nums[:size])`,
  },
  'remove-duplicates-from-sorted-array-ii': {
    variables: ['nums', 'read', 'write'],
    output: '[1, 1, 2, 2, 5]',
    code: `def keep_at_most_two(nums):
    write = 0
    for read in range(len(nums)):
        if write >= 2 and nums[read] == nums[write - 2]:
            continue  # Step: Skip extra copy | Two copies already appear in the retained prefix.
        nums[write] = nums[read]  # Step: Keep copy | This value still has room in the retained prefix.
        write += 1
    return write

nums = [1, 1, 1, 2, 2, 2, 5]
size = keep_at_most_two(nums)
print(nums[:size])`,
  },
  'majority-element': {
    variables: ['value', 'candidate', 'votes'],
    output: '7',
    code: `def majority(nums):
    candidate = None
    votes = 0
    for value in nums:
        if votes == 0:
            candidate = value  # Step: Pick candidate | A zero balance lets the current value become the candidate.
        if value == candidate:
            votes += 1  # Step: Add vote | The current value supports the candidate.
        else:
            votes -= 1  # Step: Cancel vote | Pair this value with one vote for the candidate.
    return candidate

print(majority([5, 7, 7, 5, 7, 3, 7]))`,
  },
  'rotate-array': {
    variables: ['nums', 'left', 'right', 'k'],
    output: '[5, 6, 1, 2, 3, 4]',
    code: `def reverse_range(nums, left, right):
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]  # Step: Swap endpoints | Reverse this range by moving both pointers inward.
        left += 1
        right -= 1

def rotate(nums, k):
    k %= len(nums)  # Step: Normalize rotation | Full turns leave every element in its original position.
    reverse_range(nums, 0, len(nums) - 1)
    reverse_range(nums, 0, k - 1)
    reverse_range(nums, k, len(nums) - 1)

nums = [1, 2, 3, 4, 5, 6]
rotate(nums, 2)
print(nums)`,
  },
  'best-time-to-buy-and-sell-stock': {
    variables: ['price', 'lowest', 'profit'],
    output: '6',
    code: `def max_profit(prices):
    lowest = prices[0]
    profit = 0
    for price in prices:
        profit = max(profit, price - lowest)  # Step: Compare profit | Compare selling today with the best trade so far.
        lowest = min(lowest, price)  # Step: Track buy price | Keep the cheapest price seen for a later sale.
    return profit

print(max_profit([8, 3, 6, 2, 8, 5]))`,
  },
  'best-time-to-buy-and-sell-stock-ii': {
    variables: ['prices', 'day', 'rise', 'profit'],
    output: '9',
    code: `def max_profit(prices):
    profit = 0
    for day in range(1, len(prices)):
        rise = prices[day] - prices[day - 1]
        if rise > 0:
            profit += rise  # Step: Collect rise | Add this positive day-to-day gain to the total.
    return profit

print(max_profit([6, 2, 5, 3, 9]))`,
  },
  'jump-game': {
    variables: ['nums', 'index', 'reach'],
    output: 'True',
    code: `def can_jump(nums):
    reach = 0
    for index in range(len(nums)):
        if index > reach:
            return False
        reach = max(reach, index + nums[index])  # Step: Extend reach | Extend the farthest reachable index from this reachable position.
        if reach >= len(nums) - 1:
            return True
    return False

print(can_jump([2, 1, 3, 0, 1, 0]))`,
  },
  'jump-game-ii': {
    variables: ['nums', 'index', 'reach', 'boundary', 'jumps'],
    output: '2',
    code: `def min_jumps(nums):
    reach = 0
    boundary = 0
    jumps = 0
    for index in range(len(nums) - 1):
        reach = max(reach, index + nums[index])  # Step: Extend next layer | Track the farthest position reachable with one more jump.
        if index == boundary:
            jumps += 1
            boundary = reach  # Step: Commit jump | Close this layer and use its farthest reach as the next boundary.
    return jumps

print(min_jumps([2, 4, 1, 0, 2, 0]))`,
  },
  'h-index': {
    variables: ['buckets', 'citation', 'h', 'papers'],
    output: '3',
    code: `def h_index(citations):
    size = len(citations)
    buckets = [0] * (size + 1)
    for citation in citations:
        buckets[min(citation, size)] += 1  # Step: Count paper | Bucket each paper, capping counts at the number of papers.
    papers = 0
    for h in range(size, -1, -1):
        papers += buckets[h]  # Step: Test threshold | Count papers with at least this many citations.
        if papers >= h:
            return h

print(h_index([4, 0, 7, 1, 3, 2]))`,
  },
  'insert-delete-getrandom-o1': {
    variables: ['self', 'value', 'index', 'tail'],
    output: 'True\nTrue\nTrue\n8',
    code: `import random

class RandomizedSet:
    def __init__(self):
        self.values = []
        self.positions = {}

    def insert(self, value):
        if value in self.positions:
            return False
        self.positions[value] = len(self.values)
        self.values.append(value)  # Step: Append value | Store the value at its recorded array index.
        return True

    def remove(self, value):
        if value not in self.positions:
            return False
        index = self.positions[value]
        tail = self.values[-1]
        self.values[index] = tail  # Step: Fill gap | Move the last value into the removed value's slot.
        self.positions[tail] = index
        self.values.pop()  # Step: Remove tail | Shrink the array without shifting other entries.
        self.positions.pop(value)
        return True

    def get_random(self):
        return random.choice(self.values)

items = RandomizedSet()
print(items.insert(4))
print(items.insert(8))
print(items.remove(4))
# A single remaining value makes the sample output deterministic.
print(items.get_random())`,
  },
  'product-of-array-except-self': {
    variables: ['nums', 'result', 'index', 'prefix', 'suffix'],
    output: '[0, -12, 0, 0]',
    code: `def products(nums):
    result = [1] * len(nums)
    prefix = 1
    for index in range(len(nums)):
        result[index] = prefix  # Step: Store left product | Record the product strictly to the left of this index.
        prefix *= nums[index]
    suffix = 1
    for index in range(len(nums) - 1, -1, -1):
        result[index] *= suffix  # Step: Add right product | Multiply by the product strictly to the right.
        suffix *= nums[index]
    return result

print(products([2, 0, -3, 2]))`,
  },
  'gas-station': {
    variables: ['gas', 'cost', 'station', 'tank', 'total', 'start'],
    output: '2',
    code: `def circuit(gas, cost):
    start = 0
    tank = 0
    total = 0
    for station in range(len(gas)):
        change = gas[station] - cost[station]
        total += change
        tank += change  # Step: Update tank | Add the station's net fuel to the current attempt.
        if tank < 0:
            start = station + 1  # Step: Move start | A deficit rules out this attempt and the starts it passed.
            tank = 0
    if total < 0:
        return -1
    return start

print(circuit([2, 1, 5, 3], [3, 3, 1, 2]))`,
  },
  candy: {
    variables: ['ratings', 'candies', 'index'],
    output: '8',
    code: `def candy(ratings):
    candies = [1] * len(ratings)
    for index in range(1, len(ratings)):
        if ratings[index] > ratings[index - 1]:
            candies[index] = candies[index - 1] + 1  # Step: Check left neighbor | Give a higher-rated child more than the child on the left.
    for index in range(len(ratings) - 2, -1, -1):
        if ratings[index] > ratings[index + 1]:
            candies[index] = max(candies[index], candies[index + 1] + 1)  # Step: Check right neighbor | Satisfy the right neighbor while preserving the earlier requirement.
    return sum(candies)

print(candy([3, 1, 2, 2, 1]))`,
  },
  'trapping-rain-water': {
    variables: ['height', 'left', 'right', 'left_max', 'right_max', 'water'],
    output: '8',
    code: `def trap(height):
    left = 0
    right = len(height) - 1
    left_max = right_max = water = 0
    while left <= right:
        if height[left] <= height[right]:
            left_max = max(left_max, height[left])
            water += left_max - height[left]  # Step: Resolve left | The right side provides a boundary for this left position.
            left += 1
        else:
            right_max = max(right_max, height[right])
            water += right_max - height[right]  # Step: Resolve right | The left side provides a boundary for this right position.
            right -= 1
    return water

print(trap([3, 0, 1, 0, 4]))`,
  },
  'roman-to-integer': {
    variables: ['symbol', 'value', 'previous', 'total'],
    output: '944',
    code: `def roman_to_int(roman):
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    previous = 0
    for symbol in reversed(roman):
        value = values[symbol]
        if value < previous:
            total -= value  # Step: Subtract symbol | This smaller symbol sits before a larger one.
        else:
            total += value  # Step: Add symbol | The symbol contributes its ordinary value.
        previous = value
    return total

print(roman_to_int("CMXLIV"))`,
  },
  'integer-to-roman': {
    variables: ['number', 'value', 'symbol', 'roman'],
    output: 'MCMXLIV',
    code: `def int_to_roman(number):
    pairs = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
             (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
             (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    roman = ""
    for value, symbol in pairs:
        while number >= value:
            roman += symbol  # Step: Append symbol | Use the largest available Roman token that fits.
            number -= value  # Step: Reduce remainder | Remove the value represented by the token.
    return roman

print(int_to_roman(1944))`,
  },
  'length-of-last-word': {
    variables: ['text', 'index', 'size'],
    output: '5',
    code: `def last_word_length(text):
    index = len(text) - 1
    while index >= 0 and text[index] == " ":
        index -= 1  # Step: Skip trailing space | Move left until the last word begins.
    size = 0
    while index >= 0 and text[index] != " ":
        size += 1  # Step: Count letter | Count the word until another space or the start of the text.
        index -= 1
    return size

print(last_word_length("learn with dryrun today   "))`,
  },
  'longest-common-prefix': {
    variables: ['prefix', 'word'],
    output: 'fl',
    code: `def common_prefix(words):
    prefix = words[0]
    for word in words[1:]:
        while prefix and word[:len(prefix)] != prefix:
            prefix = prefix[:-1]  # Step: Shorten prefix | Drop the last letter until this word agrees with the shared prefix.
    return prefix

print(common_prefix(["flight", "flip", "flow"]))`,
  },
  'reverse-words-in-a-string': {
    variables: ['words', 'index', 'result'],
    output: 'code trace read',
    code: `def reverse_words(text):
    words = text.split()  # Step: Split words | Separate the words and discard extra spaces.
    result = ""
    for index in range(len(words) - 1, -1, -1):
        if result:
            result += " "
        result += words[index]  # Step: Append word | Read words from right to left and append them to the result.
    return result

print(reverse_words("  read  trace   code  "))`,
  },
  'zigzag-conversion': {
    variables: ['rows', 'row', 'direction', 'letter'],
    output: 'AEIBDFHJCG',
    code: `def zigzag(text, count):
    if count == 1:
        return text
    rows = [""] * count
    row = 0
    direction = 1
    for letter in text:
        rows[row] += letter  # Step: Place letter | Append this letter to the current zigzag row.
        if row == 0:
            direction = 1  # Step: Turn down | The top row is a turning point.
        elif row == count - 1:
            direction = -1  # Step: Turn up | The bottom row is a turning point.
        row += direction
    return "".join(rows)

print(zigzag("ABCDEFGHIJ", 3))`,
  },
  'find-the-index-of-the-first-occurrence-in-a-string': {
    variables: ['text', 'pattern', 'start', 'candidate'],
    output: '2',
    code: `def first_occurrence(text, pattern):
    size = len(pattern)
    for start in range(len(text) - size + 1):
        candidate = text[start:start + size]  # Step: Test window | Compare a same-length window with the pattern.
        if candidate == pattern:
            return start
    return -1

print(first_occurrence("cababc", "bab"))`,
  },
  'text-justification': {
    variables: ['line', 'words', 'start', 'end', 'spaces', 'extra'],
    output: 'Practice···with\nsmall··examples\nfirst··········',
    code: `def justify(words, width):
    output = []
    start = 0
    while start < len(words):
        end = start + 1
        letters = len(words[start])
        while end < len(words) and letters + len(words[end]) + end - start <= width:
            letters += len(words[end])  # Step: Fit word | Include this word only when it fits with the required gaps.
            end += 1
        gaps = end - start - 1
        if end == len(words) or gaps == 0:
            line = " ".join(words[start:end])
            line += " " * (width - len(line))  # Step: Pad right | Left-align the last line or a single word.
        else:
            spaces = (width - letters) // gaps
            extra = (width - letters) % gaps
            line = words[start]
            for index in range(gaps):
                line += " " * (spaces + int(index < extra)) + words[start + index + 1]  # Step: Share spaces | Give the leftmost gaps one extra space when needed.
        output.append(line)
        start = end
    return output

for line in justify(["Practice", "with", "small", "examples", "first"], 15):
    print(line.replace(" ", "·"))`,
  },
  'valid-palindrome': {
    variables: ['text', 'left', 'right'],
    output: 'True',
    code: `def is_palindrome(text):
    left = 0
    right = len(text) - 1
    while left < right:
        if not text[left].isalnum():
            left += 1  # Step: Skip left punctuation | Advance to a letter or digit on the left.
        elif not text[right].isalnum():
            right -= 1  # Step: Skip right punctuation | Advance to a letter or digit on the right.
        elif text[left].lower() != text[right].lower():
            return False
        else:
            left += 1
            right -= 1  # Step: Match pair | Both characters match ignoring case, so move inward.
    return True

print(is_palindrome("Never odd, or even."))`,
  },
  ...interviewLessons26to50,
  ...interviewLessons51to75,
  ...interviewLessons76to100,
  ...interviewLessons101to125,
  ...interviewLessons126to150,
};
