import { list, tree } from './interview-lessons-51-75.js';

export const interviewLessons101to125 = {
  'letter-combinations-of-a-phone-number': {
    variables: ['digits', 'index', 'letter', 'path', 'result'],
    output: "['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf']",
    code: `def combinations(digits):
    letters = ["abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"]
    result, path = [], []

    def build(index):
        if index == len(digits):
            result.append("".join(path))  # Step: Save combination | One letter has been chosen for each digit.
            return
        for letter in letters[int(digits[index]) - 2]:
            path.append(letter)  # Step: Choose letter | Extend this prefix with a letter for the current digit.
            build(index + 1)
            path.pop()  # Step: Undo letter | Restore the prefix before trying the next letter.

    if digits:
        build(0)
    return result

print(combinations("23"))`,
  },
  'combinations': {
    variables: ['next_value', 'value', 'needed', 'path', 'result'],
    output: '[[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]',
    code: `def choose(n, k):
    result, path = [], []

    def build(next_value):
        needed = k - len(path)
        if needed == 0:
            result.append(path.copy())  # Step: Save subset | Copy the current path before further choices mutate it.
            return
        for value in range(next_value, n - needed + 2):
            path.append(value)  # Step: Choose value | The next choice must be larger so each combination appears once.
            build(value + 1)
            path.pop()  # Step: Undo choice | Restore the shorter combination.

    build(1)
    return result

print(choose(4, 2))`,
  },
  'permutations': {
    variables: ['nums', 'i', 'current_path', 'used', 'result'],
    output: '[[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]',
    code: `def permute(nums):
    result = []
    current_path = []
    used = [False] * len(nums)

    def backtrack():
        if len(current_path) == len(nums):
            result.append(current_path.copy())  # Step: Save permutation | Copy the completed path so later undo steps cannot change it.
            return
        for i in range(len(nums)):
            if used[i]:
                continue  # Step: Skip used index | This element already has a place in the current path.
            current_path.append(nums[i])
            used[i] = True  # Step: Choose element | Add this value and mark its index before exploring.
            backtrack()
            current_path.pop()
            used[i] = False  # Step: Undo choice | Remove the last value and free its index for the next branch.

    backtrack()
    return result

print(permute([1, 2, 3]))`,
  },
  'combination-sum': {
    variables: ['remaining', 'value', 'path', 'result'],
    output: '[[2, 2, 3], [7]]',
    code: `def combination_sum(nums, target):
    nums = sorted(nums)
    result, path = [], []

    def build(start, remaining):
        if remaining == 0:
            result.append(path.copy())  # Step: Save match | The current choices add up to the target.
            return
        for index in range(start, len(nums)):
            value = nums[index]
            if value > remaining:
                break  # Step: Prune large choices | Later values are at least as large and would also overshoot.
            path.append(value)  # Step: Choose value | Start the next search at this index to allow reuse.
            build(index, remaining - value)
            path.pop()  # Step: Undo choice | Restore the prefix before trying a larger value.

    build(0, target)
    return result

print(combination_sum([2, 3, 6, 7], 7))`,
  },
  'n-queens-ii': {
    grid: 'board',
    variables: ['board', 'row', 'col', 'solutions'],
    output: '2',
    code: `def count_queens(size):
    cols, down, up = set(), set(), set()
    board = [["."] * size for _ in range(size)]
    solutions = 0

    def place(row):
        nonlocal solutions
        if row == size:
            solutions += 1  # Step: Count board | Every row has one queen and no two queens attack.
            return
        for col in range(size):
            if col in cols or row - col in down or row + col in up:
                continue  # Step: Skip attacked cell | A queen already occupies this column or one of these diagonals.
            cols.add(col)
            down.add(row - col)
            up.add(row + col)
            board[row][col] = "Q"  # Step: Place queen | Mark the safe position before searching the next row.
            place(row + 1)
            cols.remove(col)
            down.remove(row - col)
            up.remove(row + col)
            board[row][col] = "."  # Step: Remove queen | Release the square and both diagonals before trying another column.

    place(0)
    return solutions

print(count_queens(4))`,
  },
  'generate-parentheses': {
    variables: ['opened', 'closed', 'path', 'result'],
    output: "['((()))', '(()())', '(())()', '()(())', '()()()']",
    code: `def parentheses(n):
    result, path = [], []

    def build(opened, closed):
        if closed == n:
            result.append("".join(path))  # Step: Save balanced string | All open parentheses have been matched.
            return
        if opened < n:
            path.append("(")  # Step: Open pair | An opening parenthesis is available.
            build(opened + 1, closed)
            path.pop()  # Step: Undo open | Restore the prefix before trying a closing parenthesis.
        if closed < opened:
            path.append(")")  # Step: Close pair | A closing parenthesis can match an earlier unmatched opener.
            build(opened, closed + 1)
            path.pop()  # Step: Undo close | Restore the prefix when this branch finishes.

    build(0, 0)
    return result

print(parentheses(3))`,
  },
  'word-search': {
    grid: 'board',
    variables: ['board', 'word', 'index', 'letter'],
    output: 'True\nFalse',
    code: `def exists(board, word):
    height, width = len(board), len(board[0])

    def search(row, col, index):
        if not (0 <= row < height and 0 <= col < width):
            return False
        if board[row][col] != word[index]:
            return False
        letter = board[row][col]
        board[row][col] = "#"  # Step: Reserve cell | This square matches and cannot be used twice in the current path.
        found = index == len(word) - 1
        if not found:
            for dr, dc in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
                if search(row + dr, col + dc, index + 1):
                    found = True
                    break
        board[row][col] = letter  # Step: Restore cell | Restore the letter before returning from this path.
        return found

    for row in range(height):
        for col in range(width):
            if search(row, col, 0):
                return True
    return False

board = [list("ABCE"), list("SFCS"), list("ADEE")]
print(exists(board, "ABCCED"))
print(exists(board, "ABCB"))`,
  },
  'convert-sorted-array-to-binary-search-tree': tree(`def sorted_to_bst(nums):
    def build(low, high):
        if low > high:
            return None
        mid = (low + high) // 2
        node = TreeNode(nums[mid])  # Step: Choose middle | The midpoint gives the two branches nearly equal numbers of values.
        node.left = build(low, mid - 1)
        node.right = build(mid + 1, high)  # Step: Attach halves | Smaller values go left and larger values go right.
        return node

    return build(0, len(nums) - 1)

root = sorted_to_bst([-5, -2, 0, 3, 8])
print([root.val, root.left.val, root.right.val, root.left.right.val, root.right.right.val])`, ['nums', 'low', 'high', 'mid', 'node'], '[0, -5, 3, -2, 8]'),
  'sort-list': list(`def sort_list(head):
    if head is None or head.next is None:
        return head
    slow, fast = head, head.next
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    second = slow.next
    slow.next = None  # Step: Split list | The fast pointer reached the end while slow reached the split.
    left, right = sort_list(head), sort_list(second)
    dummy = Node(0)
    tail = dummy
    while left is not None and right is not None:
        if left.val <= right.val:
            tail.next = left  # Step: Link left | The left run starts with the smaller remaining value.
            left = left.next
        else:
            tail.next = right  # Step: Link right | The right run starts with the smaller remaining value.
            right = right.next
        tail = tail.next
    tail.next = left if left is not None else right
    return dummy.next

print(values_of(sort_list(make_list([4, 1, 5, 2, 3]))))`, ['head', 'slow', 'second', 'left', 'right', 'tail'], '[1, 2, 3, 4, 5]'),
  'construct-quad-tree': {
    grid: 'grid',
    variables: ['grid', 'top', 'left', 'size', 'value', 'uniform'],
    output: '[False, 1, 0, 0, 1]',
    code: `class Quad:
    def __init__(self, val, leaf, children=None):
        self.val = val
        self.leaf = leaf
        self.children = children

def construct(grid):
    def build(top, left, size):
        value = grid[top][left]
        uniform = True
        for row in range(top, top + size):
            for col in range(left, left + size):
                if grid[row][col] != value:
                    uniform = False
        if uniform:
            leaf = Quad(value, True)  # Step: Create leaf | All cells in this square have the same value.
            return leaf
        half = size // 2  # Step: Split quadrants | Divide the mixed square into four equal squares.
        children = [build(top, left, half), build(top, left + half, half),
                    build(top + half, left, half), build(top + half, left + half, half)]
        return Quad(1, False, children)

    return build(0, 0, len(grid))

root = construct([[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 1, 1]])
print([root.leaf, root.children[0].val, root.children[1].val, root.children[2].val, root.children[3].val])`,
  },
  'merge-k-sorted-lists': list(`def merge_k(heads):
    def merge(left, right):
        dummy = Node(0)
        tail = dummy
        while left is not None and right is not None:
            if left.val <= right.val:
                tail.next = left  # Step: Take left head | Append the smaller node from the two runs.
                left = left.next
            else:
                tail.next = right  # Step: Take right head | Append the smaller node from the two runs.
                right = right.next
            tail = tail.next
        tail.next = left if left is not None else right
        return dummy.next

    while len(heads) > 1:
        combined = []
        for index in range(0, len(heads), 2):
            right = heads[index + 1] if index + 1 < len(heads) else None
            combined.append(merge(heads[index], right))  # Step: Finish pair | One sorted list replaces each pair in this round.
        heads = combined
    return heads[0] if heads else None

print(values_of(merge_k([make_list([1, 5]), make_list([2, 4]), make_list([3, 6])])))`, ['left', 'right', 'tail', 'heads', 'combined'], '[1, 2, 3, 4, 5, 6]'),
  'maximum-subarray': {
    variables: ['nums', 'index', 'value', 'ending', 'best'],
    output: '6',
    code: `def maximum_sum(nums):
    ending = best = nums[0]
    for index in range(1, len(nums)):
        value = nums[index]
        ending = max(value, ending + value)  # Step: Restart or extend | Keep the better sum ending at this index.
        best = max(best, ending)  # Step: Compare best | The overall maximum can end at any index.
    return best

print(maximum_sum([-2, 1, -3, 4, -1, 2, 1, -5, 4]))`,
  },
  'maximum-sum-circular-subarray': {
    variables: ['value', 'max_ending', 'min_ending', 'best', 'worst', 'total', 'wrapped'],
    output: '10\n-2',
    code: `def circular_sum(nums):
    best = worst = max_ending = min_ending = total = nums[0]
    for value in nums[1:]:
        total += value
        max_ending = max(value, max_ending + value)
        best = max(best, max_ending)  # Step: Track regular maximum | Find the best contiguous run without wrapping.
        min_ending = min(value, min_ending + value)
        worst = min(worst, min_ending)  # Step: Track excluded minimum | A wrapped run keeps everything outside one minimum-sum run.
    if best < 0:
        return best
    wrapped = total - worst  # Step: Compare wrapping | Subtract the excluded run and compare with the regular maximum.
    return max(best, wrapped)

print(circular_sum([5, -3, 5]))
print(circular_sum([-3, -2, -5]))`,
  },
  'search-insert-position': {
    search: 'nums',
    variables: ['nums', 'target', 'low', 'high', 'mid'],
    output: '2',
    code: `def insertion_index(nums, target):
    low, high = 0, len(nums)
    while low < high:
        mid = (low + high) // 2  # Step: Probe middle | Test the middle of the remaining half-open interval.
        if nums[mid] < target:
            low = mid + 1  # Step: Discard lower values | Every index through mid is too small.
        else:
            high = mid  # Step: Keep candidate | This index is large enough and could be the first one.
    return low

print(insertion_index([1, 3, 5, 6], 4))`,
  },
  'search-a-2d-matrix': {
    grid: 'matrix',
    variables: ['matrix', 'target', 'low', 'high', 'row', 'col', 'value'],
    output: 'True',
    code: `def search_matrix(matrix, target):
    cols = len(matrix[0])
    low, high = 0, len(matrix) * cols - 1
    while low <= high:
        mid = (low + high) // 2
        row, col = divmod(mid, cols)
        value = matrix[row][col]  # Step: Probe cell | Convert the flattened index into its row and column.
        if value == target:
            return True
        if value < target:
            low = mid + 1
        else:
            high = mid - 1
    return False

print(search_matrix([[1, 4, 8], [12, 15, 20], [25, 29, 34]], 29))`,
  },
  'find-peak-element': {
    search: 'nums',
    inclusive: true,
    variables: ['nums', 'low', 'high', 'mid'],
    output: '3',
    code: `def peak(nums):
    low, high = 0, len(nums) - 1
    while low < high:
        mid = (low + high) // 2  # Step: Compare slope | Compare the midpoint with its immediate right neighbor.
        if nums[mid] < nums[mid + 1]:
            low = mid + 1  # Step: Follow rise | An upward slope guarantees a peak somewhere to the right.
        else:
            high = mid  # Step: Keep left side | A downward slope leaves a peak at mid or to its left.
    return low

print(peak([1, 3, 5, 8, 4, 2]))`,
  },
  'search-in-rotated-sorted-array': {
    search: 'nums',
    inclusive: true,
    variables: ['nums', 'target', 'low', 'high', 'mid', 'left_sorted'],
    output: '4',
    code: `def rotated_search(nums, target):
    low, high = 0, len(nums) - 1
    while low <= high:
        mid = (low + high) // 2  # Step: Probe middle | Check for the target before narrowing the range.
        if nums[mid] == target:
            return mid
        left_sorted = nums[low] <= nums[mid]  # Step: Identify sorted half | At least one half stays sorted despite the rotation.
        if left_sorted:
            if nums[low] <= target < nums[mid]:
                high = mid - 1
            else:
                low = mid + 1
        else:
            if nums[mid] < target <= nums[high]:
                low = mid + 1
            else:
                high = mid - 1
    return -1

print(rotated_search([4, 5, 6, 7, 0, 1, 2], 0))`,
  },
  'find-first-and-last-position-of-element-in-sorted-array': {
    search: 'nums',
    variables: ['nums', 'target', 'past_equal', 'low', 'high', 'mid', 'first'],
    output: '[1, 3]',
    code: `def matching_range(nums, target):
    def boundary(past_equal):
        low, high = 0, len(nums)
        while low < high:
            mid = (low + high) // 2  # Step: Probe boundary | The first pass seeks the first match. The second seeks the first larger value.
            if nums[mid] < target or (past_equal and nums[mid] == target):
                low = mid + 1  # Step: Move lower bound | Discard the midpoint and everything before it.
            else:
                high = mid  # Step: Move upper bound | Keep the midpoint as a possible boundary.
        return low

    first = boundary(False)
    if first == len(nums) or nums[first] != target:
        return [-1, -1]
    return [first, boundary(True) - 1]

print(matching_range([1, 3, 3, 3, 6, 9], 3))`,
  },
  'find-minimum-in-rotated-sorted-array': {
    search: 'nums',
    inclusive: true,
    variables: ['nums', 'low', 'high', 'mid'],
    output: '0',
    code: `def rotated_minimum(nums):
    low, high = 0, len(nums) - 1
    while low < high:
        mid = (low + high) // 2  # Step: Probe against right edge | Compare the midpoint with the rightmost value still in play.
        if nums[mid] > nums[high]:
            low = mid + 1  # Step: Move past larger values | The drop to the minimum must be to the right.
        else:
            high = mid  # Step: Keep midpoint | The midpoint can still be the minimum.
    return nums[low]

print(rotated_minimum([4, 5, 6, 7, 0, 1, 2]))`,
  },
  'median-of-two-sorted-arrays': {
    variables: ['first', 'second', 'low', 'high', 'cut', 'other', 'left_a', 'right_a', 'left_b', 'right_b'],
    output: '5.5',
    code: `def median(first, second):
    if len(first) > len(second):
        first, second = second, first
    m, n = len(first), len(second)
    half = (m + n + 1) // 2
    low, high = 0, m
    while low <= high:
        cut = (low + high) // 2
        other = half - cut
        left_a = first[cut - 1] if cut else float("-inf")
        right_a = first[cut] if cut < m else float("inf")
        left_b = second[other - 1] if other else float("-inf")
        right_b = second[other] if other < n else float("inf")  # Step: Inspect cuts | Together the left partitions hold half the values.
        if left_a > right_b:
            high = cut - 1  # Step: Move first cut left | Too many large values from the first array sit on the left.
        elif left_b > right_a:
            low = cut + 1  # Step: Move first cut right | Take more of the smaller first-array values into the left partition.
        else:
            lower = max(left_a, left_b)  # Step: Read median | Every value on the left is at most every value on the right.
            if (m + n) % 2:
                return lower
            return (lower + min(right_a, right_b)) / 2

print(median([1, 2, 8], [3, 4, 7, 9, 10]))`,
  },
  'kth-largest-element-in-an-array': {
    heap: 'heap',
    variables: ['heap', 'value', 'k'],
    output: '5',
    code: `import heapq

def kth_largest(nums, k):
    heap = []
    for value in nums:
        heapq.heappush(heap, value)  # Step: Add contender | Include this value among the candidates for the top k.
        if len(heap) > k:
            dropped = heapq.heappop(heap)  # Step: Discard smallest | Keep only the k largest values seen so far.
    return heap[0]

print(kth_largest([3, 2, 1, 5, 6, 4], 2))`,
  },
  'ipo': {
    heap: 'available',
    variables: ['available', 'capital', 'index', 'profit', 'gain'],
    output: '4',
    code: `import heapq

def maximize_capital(k, capital, profits, costs):
    projects = sorted(zip(costs, profits))
    available = []
    index = 0
    for _ in range(k):
        while index < len(projects) and projects[index][0] <= capital:
            profit = projects[index][1]
            heapq.heappush(available, -profit)  # Step: Add affordable project | Store the negative profit so the largest gain comes out first.
            index += 1
        if not available:
            break
        gain = -heapq.heappop(available)
        capital += gain  # Step: Take largest profit | The best available gain can unlock more projects.
    return capital

print(maximize_capital(2, 0, [1, 2, 3], [0, 1, 1]))`,
  },
  'find-k-pairs-with-smallest-sums': {
    variables: ['heap', 'first', 'second', 'i', 'j', 'result'],
    output: '[[1, 2], [1, 4], [1, 6]]',
    code: `import heapq

def smallest_pairs(first, second, k):
    if not first or not second or k <= 0:
        return []
    heap, result = [], []
    for i in range(min(k, len(first))):
        heapq.heappush(heap, (first[i] + second[0], i, 0))  # Step: Seed pair row | Each first-array value starts with the smallest second-array value.
    while heap and len(result) < k:
        total, i, j = heapq.heappop(heap)
        result.append([first[i], second[j]])  # Step: Save smallest pair | The heap root was the smallest sum among the row frontiers.
        if j + 1 < len(second):
            heapq.heappush(heap, (first[i] + second[j + 1], i, j + 1))  # Step: Advance pair row | Only this row needs a new candidate.
    return result

print(smallest_pairs([1, 7, 11], [2, 4, 6], 3))`,
  },
  'find-median-from-data-stream': {
    variables: ['value', 'lower', 'upper'],
    output: '2.5\n2',
    code: `import heapq

class MedianFinder:
    def __init__(self):
        self.lower = []
        self.upper = []

    def add(self, value):
        lower, upper = self.lower, self.upper
        heapq.heappush(lower, -value)  # Step: Push into lower heap | Negative keys make the largest lower value accessible.
        heapq.heappush(upper, -heapq.heappop(lower))  # Step: Move boundary | Transfer the largest lower value to maintain sorted halves.
        if len(upper) > len(lower):
            heapq.heappush(lower, -heapq.heappop(upper))  # Step: Rebalance sizes | Move back the smallest upper value so lower holds the extra item.

    def median(self):
        if len(self.lower) > len(self.upper):
            return -self.lower[0]
        return (-self.lower[0] + self.upper[0]) / 2

stream = MedianFinder()
stream.add(1)
stream.add(4)
print(stream.median())
stream.add(2)
print(stream.median())`,
  },
  'add-binary': {
    variables: ['first', 'second', 'left', 'right', 'carry', 'bit', 'bits'],
    output: '10000',
    code: `def add_binary(first, second):
    left, right = len(first) - 1, len(second) - 1
    bits, carry = [], 0
    while left >= 0 or right >= 0 or carry:
        total = carry
        if left >= 0:
            total += int(first[left])
            left -= 1
        if right >= 0:
            total += int(second[right])
            right -= 1
        carry, bit = divmod(total, 2)
        bits.append(str(bit))  # Step: Write bit and carry | Keep the remainder as this bit and pass the quotient to the next column.
    return "".join(reversed(bits))

print(add_binary("1011", "101"))`,
  },
};
