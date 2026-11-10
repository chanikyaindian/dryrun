import { tree } from './interview-lessons-51-75.js';

export const interviewLessons76to100 = {
  'path-sum': tree(`def has_path(node, target):
    if node is None:
        return False
    remaining = target - node.val  # Step: Subtract node | Only the remaining sum needs to be found below this node.
    if node.left is None and node.right is None:
        match = remaining == 0  # Step: Check leaf | A root-to-leaf path qualifies only when the remainder is zero.
        return match
    return has_path(node.left, remaining) or has_path(node.right, remaining)

root = TreeNode(5, TreeNode(3, TreeNode(2)), TreeNode(7))
print(has_path(root, 12))
print(has_path(root, 8))`, ['node', 'target', 'remaining', 'match'], 'True\nFalse'),
  'sum-root-to-leaf-numbers': tree(`def path_numbers(node, prefix=0):
    if node is None:
        return 0
    number = prefix * 10 + node.val  # Step: Append digit | Shift the existing prefix by one decimal place and append this node.
    if node.left is None and node.right is None:
        return number
    total = path_numbers(node.left, number) + path_numbers(node.right, number)  # Step: Combine branches | Add the complete numbers returned by both subtrees.
    return total

root = TreeNode(4, TreeNode(9, TreeNode(5), TreeNode(1)), TreeNode(0))
print(path_numbers(root))`, ['node', 'prefix', 'number', 'total'], '1026'),
  'binary-tree-maximum-path-sum': tree(`def maximum_path(root):
    best = root.val

    def gain(node):
        nonlocal best
        if node is None:
            return 0
        left = max(0, gain(node.left))
        right = max(0, gain(node.right))
        through = node.val + left + right
        best = max(best, through)  # Step: Compare full path | A path can join both profitable branches at this node.
        upward = node.val + max(left, right)  # Step: Return one branch | A path continuing to the parent can keep only one child branch.
        return upward

    gain(root)
    return best

root = TreeNode(-4, TreeNode(3), TreeNode(8, TreeNode(5), TreeNode(2)))
print(maximum_path(root))`, ['node', 'left', 'right', 'through', 'best', 'upward'], '15'),
  'binary-search-tree-iterator': tree(`class BSTIterator:
    def __init__(self, root):
        self.stack = []
        self.push_left(root)

    def push_left(self, node):
        stack = self.stack
        while node is not None:
            stack.append(node)  # Step: Save left spine | Keep each ancestor until its left subtree is exhausted.
            node = node.left

    def next(self):
        stack = self.stack
        node = stack.pop()  # Step: Visit next node | The stack top is the smallest unvisited value.
        self.push_left(node.right)
        return node.val

    def has_next(self):
        return bool(self.stack)

root = TreeNode(5, TreeNode(2), TreeNode(8, TreeNode(6)))
iterator = BSTIterator(root)
order = []
while iterator.has_next():
    order.append(iterator.next())
print(order)`, ['node', 'stack', 'order'], '[2, 5, 6, 8]'),
  'count-complete-tree-nodes': tree(`def count_nodes(node):
    if node is None:
        return 0
    left, right = node, node
    left_height = right_height = 0
    while left is not None:
        left_height += 1
        left = left.left
    while right is not None:
        right_height += 1
        right = right.right
    if left_height == right_height:
        size = (1 << left_height) - 1  # Step: Count perfect subtree | Equal outer heights in a complete tree mean every level here is full.
        return size
    size = 1 + count_nodes(node.left) + count_nodes(node.right)  # Step: Count partial subtree | The last level is incomplete. Count each child subtree separately.
    return size

root = TreeNode(1, TreeNode(2, TreeNode(4), TreeNode(5)), TreeNode(3, TreeNode(6)))
print(count_nodes(root))`, ['node', 'left_height', 'right_height', 'size'], '6'),
  'lowest-common-ancestor-of-a-binary-tree': tree(`def ancestor(node, first, second):
    if node is None or node is first or node is second:
        return node
    left = ancestor(node.left, first, second)
    right = ancestor(node.right, first, second)  # Step: Compare branch results | Check which sides contain a target.
    if left is not None and right is not None:
        answer = node  # Step: Join two matches | Targets on opposite sides meet at this ancestor.
    else:
        answer = left if left is not None else right  # Step: Pass up match | A single nonempty branch carries its match upward.
    return answer

root = TreeNode(5, TreeNode(2, TreeNode(1), TreeNode(3)), TreeNode(8))
print(ancestor(root, root.left.left, root.left.right).val)`, ['node', 'first', 'second', 'left', 'right', 'answer'], '2'),
  'binary-tree-right-side-view': tree(`from collections import deque

def right_view(root):
    if root is None:
        return []
    queue = deque([root])
    visible = []
    while queue:
        size = len(queue)
        for _ in range(size):
            node = queue.popleft()  # Step: Visit node | Process this level from left to right.
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        visible.append(node.val)  # Step: Keep rightmost | The last value seen is visible from the right.
    return visible

root = TreeNode(1, TreeNode(2, None, TreeNode(5)), TreeNode(3))
print(right_view(root))`, ['node', 'size', 'queue', 'visible'], '[1, 3, 5]'),
  'average-of-levels-in-binary-tree': tree(`from collections import deque

def level_averages(root):
    if root is None:
        return []
    queue = deque([root])
    averages = []
    while queue:
        size = len(queue)
        total = 0
        for _ in range(size):
            node = queue.popleft()
            total += node.val  # Step: Add node value | Sum the nodes that belonged to this level when it started.
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        average = total / size
        averages.append(average)  # Step: Record average | Divide by this level's node count.
    return averages

root = TreeNode(1, TreeNode(2, TreeNode(4), TreeNode(5)), TreeNode(3))
for average in level_averages(root):
    print(int(average) if average == int(average) else average)`, ['node', 'queue', 'size', 'total', 'average', 'averages'], '1\n2.5\n4.5'),
  'binary-tree-level-order-traversal': tree(`from collections import deque

def levels(root):
    if root is None:
        return []
    queue = deque([root])
    order = []
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)  # Step: Record node | Append this value to the current depth.
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        order.append(level)  # Step: Finish level | Nodes enqueued during this pass belong to the next depth.
    return order

root = TreeNode(5, TreeNode(2, TreeNode(1)), TreeNode(8, None, TreeNode(9)))
print(levels(root))`, ['node', 'queue', 'level', 'order'], '[[5], [2, 8], [1, 9]]'),
  'binary-tree-zigzag-level-order-traversal': tree(`from collections import deque

def zigzag(root):
    if root is None:
        return []
    queue = deque([root])
    order = []
    forward = True
    while queue:
        size = len(queue)
        level = [0] * size
        for index in range(size):
            node = queue.popleft()
            slot = index if forward else size - 1 - index
            level[slot] = node.val  # Step: Fill next slot | Keep the BFS order and write values in the direction for this level.
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        order.append(level)
        forward = not forward  # Step: Switch direction | The next level fills its output in the opposite direction.
    return order

root = TreeNode(1, TreeNode(2, TreeNode(4), TreeNode(5)), TreeNode(3, None, TreeNode(6)))
print(zigzag(root))`, ['node', 'queue', 'forward', 'slot', 'level', 'order'], '[[1], [3, 2], [4, 5, 6]]'),
  'minimum-absolute-difference-in-bst': tree(`def min_difference(root):
    stack = []
    node, previous, best = root, None, None
    while stack or node is not None:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        if previous is not None:
            gap = node.val - previous  # Step: Compare sorted neighbors | Inorder traversal puts adjacent values next to each other.
            best = gap if best is None else min(best, gap)
        previous = node.val
        node = node.right
    return best

root = TreeNode(7, TreeNode(2), TreeNode(10, TreeNode(9)))
print(min_difference(root))`, ['node', 'stack', 'previous', 'gap', 'best'], '1'),
  'kth-smallest-element-in-a-bst': tree(`def kth_smallest(root, k):
    stack = []
    node = root
    while stack or node is not None:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        k -= 1  # Step: Count next value | Inorder visits the values from smallest to largest.
        if k == 0:
            return node.val
        node = node.right

root = TreeNode(6, TreeNode(3, TreeNode(1), TreeNode(4)), TreeNode(9))
print(kth_smallest(root, 3))`, ['node', 'stack', 'k'], '4'),
  'validate-binary-search-tree': tree(`def valid(node, low=None, high=None):
    if node is None:
        return True
    within = (low is None or low < node.val) and (high is None or node.val < high)  # Step: Check inherited bounds | The node must satisfy strict limits set by all its ancestors.
    if not within:
        return False
    return valid(node.left, low, node.val) and valid(node.right, node.val, high)

root = TreeNode(5, TreeNode(2), TreeNode(8, TreeNode(4)))
print(valid(root))`, ['node', 'low', 'high', 'within'], 'False'),
  'number-of-islands': {
    grid: 'grid',
    variables: ['grid', 'count'],
    output: '3',
    code: `def islands(grid):
    height, width = len(grid), len(grid[0])
    count = 0
    for start_row in range(height):
        for start_col in range(width):
            if grid[start_row][start_col] != "1":
                continue
            count += 1
            grid[start_row][start_col] = "0"  # Step: Start island | This is a land cell no previous flood reached.
            stack = [[start_row, start_col]]
            while stack:
                row, col = stack.pop()
                for dr, dc in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
                    nr, nc = row + dr, col + dc
                    if 0 <= nr < height and 0 <= nc < width and grid[nr][nc] == "1":
                        grid[nr][nc] = "0"  # Step: Flood neighbor | Mark this connected land before adding it to the frontier.
                        stack.append([nr, nc])
    return count

grid = [list("1100"), list("0100"), list("0010"), list("0001")]
print(islands(grid))`,
  },
  'surrounded-regions': {
    grid: 'board',
    variables: ['board'],
    output: "XXXX\nXXXX\nXXXX\nXOXX",
    code: `def capture(board):
    height, width = len(board), len(board[0])
    stack = []
    for row in range(height):
        for col in range(width):
            if (row in [0, height - 1] or col in [0, width - 1]) and board[row][col] == "O":
                board[row][col] = "S"  # Step: Save border cell | Any region touching an edge must survive.
                stack.append([row, col])
    while stack:
        row, col = stack.pop()
        for dr, dc in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
            nr, nc = row + dr, col + dc
            if 0 <= nr < height and 0 <= nc < width and board[nr][nc] == "O":
                board[nr][nc] = "S"  # Step: Save connected cell | A path to the border keeps this cell safe as well.
                stack.append([nr, nc])
    for row in range(height):
        for col in range(width):
            if board[row][col] == "S":
                board[row][col] = "O"  # Step: Restore safe region | Change the temporary safety mark back to O.
            elif board[row][col] == "O":
                board[row][col] = "X"  # Step: Capture region | This O had no route to a border.

board = [list("XXXX"), list("XOOX"), list("XXOX"), list("XOXX")]
capture(board)
for row in board:
    print("".join(row))`,
  },
  'clone-graph': {
    variables: ['node', 'neighbor', 'copies', 'frontier'],
    output: '[2, 3]\nTrue',
    code: `from collections import deque

class Node:
    def __init__(self, val):
        self.val = val
        self.neighbors = []

def clone(start):
    if start is None:
        return None
    copies = {start: Node(start.val)}
    frontier = deque([start])
    while frontier:
        node = frontier.popleft()
        for neighbor in node.neighbors:
            if neighbor not in copies:
                copies[neighbor] = Node(neighbor.val)  # Step: Discover node | Create a single copy when an original is first found.
                frontier.append(neighbor)
            copies[node].neighbors.append(copies[neighbor])  # Step: Copy edge | Connect the copies using the original adjacency.
    return copies[start]

a, b, c = Node(1), Node(2), Node(3)
a.neighbors = [b, c]
b.neighbors = [a, c]
c.neighbors = [a, b]
cloned = clone(a)
print([cloned.neighbors[0].val, cloned.neighbors[1].val])
print(cloned is not a and cloned.neighbors[0].neighbors[0] is cloned)`,
  },
  'evaluate-division': {
    variables: ['source', 'target', 'node', 'neighbor', 'product', 'ratio', 'next_product'],
    output: '6.25\n-1',
    code: `def evaluate(equations, queries):
    graph = {}
    for left, right, ratio in equations:
        graph.setdefault(left, []).append([right, ratio])
        graph.setdefault(right, []).append([left, 1 / ratio])

    def query(source, target):
        if source not in graph or target not in graph:
            return -1
        stack = [[source, 1]]
        seen = {source}
        while stack:
            node, product = stack.pop()
            if node == target:
                return product
            for neighbor, ratio in graph[node]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    next_product = product * ratio  # Step: Multiply along edge | Combine the ratio for this edge with the product already carried by the path.
                    stack.append([neighbor, next_product])
        return -1

    answers = []
    for source, target in queries:
        answers.append(query(source, target))
    return answers

answers = evaluate([["a", "b", 2.5], ["b", "c", 2.5]], [["a", "c"], ["a", "z"]])
print(answers[0])
print(answers[1])`,
  },
  'course-schedule': {
    variables: ['ready', 'incoming', 'course', 'dependent', 'completed'],
    output: 'True\nFalse',
    code: `from collections import deque

def can_finish(count, prerequisites):
    edges = []
    for _ in range(count):
        edges.append([])
    incoming = [0] * count
    for course, needed in prerequisites:
        edges[needed].append(course)
        incoming[course] += 1
    ready = deque()
    for course in range(count):
        if incoming[course] == 0:
            ready.append(course)
    completed = 0
    while ready:
        course = ready.popleft()
        completed += 1  # Step: Finish available course | This course has no remaining prerequisites.
        for dependent in edges[course]:
            incoming[dependent] -= 1  # Step: Release dependency | Remove the prerequisite that just finished.
            if incoming[dependent] == 0:
                ready.append(dependent)
    possible = completed == count  # Step: Check for cycle | Courses left over after the queue empties are blocked by a cycle.
    return possible

print(can_finish(4, [[1, 0], [2, 0], [3, 1], [3, 2]]))
print(can_finish(2, [[1, 0], [0, 1]]))`,
  },
  'course-schedule-ii': {
    variables: ['order', 'remaining', 'course', 'dependent', 'ready'],
    output: '[0, 2, 1, 3]',
    code: `from collections import deque

def course_order(count, prerequisites):
    edges = []
    for _ in range(count):
        edges.append([])
    remaining = [0] * count
    for course, needed in prerequisites:
        edges[needed].append(course)
        remaining[course] += 1
    ready = deque()
    for course in range(count):
        if remaining[course] == 0:
            ready.append(course)
    order = []
    while ready:
        course = ready.popleft()
        order.append(course)  # Step: Schedule course | Add an available course to the topological order.
        for dependent in edges[course]:
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                ready.append(dependent)  # Step: Unlock course | Its final prerequisite has been scheduled.
    return order if len(order) == count else []

print(course_order(4, [[2, 0], [1, 0], [3, 1], [3, 2]]))`,
  },
  'snakes-and-ladders': {
    grid: 'board',
    variables: ['board', 'square', 'landing', 'destination', 'moves', 'queue'],
    output: '2',
    code: `from collections import deque

def min_moves(board):
    n = len(board)
    queue = deque([[1, 0]])
    seen = {1}
    while queue:
        square, moves = queue.popleft()  # Step: Visit square | BFS considers positions in order of rolls taken.
        if square == n * n:
            return moves
        for landing in range(square + 1, min(square + 6, n * n) + 1):
            layer, col = divmod(landing - 1, n)
            row = n - 1 - layer
            if layer % 2:
                col = n - 1 - col
            jump = board[row][col]
            destination = landing if jump == -1 else jump  # Step: Resolve landing | Look up the square in the alternating row order and apply one snake or ladder.
            if destination not in seen:
                seen.add(destination)
                queue.append([destination, moves + 1])  # Step: Enqueue position | This is the fewest rolls seen for this destination.
    return -1

print(min_moves([[-1, -1, -1], [-1, -1, -1], [-1, 8, -1]]))`,
  },
  'minimum-genetic-mutation': {
    variables: ['gene', 'next_gene', 'distance', 'bank', 'queue'],
    output: '2',
    code: `from collections import deque

def mutations(start, target, choices):
    bank = set(choices)
    bank.discard(start)
    queue = deque([[start, 0]])
    while queue:
        gene, distance = queue.popleft()  # Step: Visit gene | Dequeue the next candidate in order of mutations taken.
        if gene == target:
            return distance
        for index in range(len(gene)):
            for base in "ACGT":
                next_gene = gene[:index] + base + gene[index + 1:]
                if next_gene in bank:
                    bank.remove(next_gene)
                    queue.append([next_gene, distance + 1])  # Step: Accept mutation | This single change produces a valid, unvisited bank entry.
    return -1

print(mutations("AACCGGTT", "AAACGGTA", ["AACCGGTA", "AACCGCTA", "AAACGGTA"]))`,
  },
  'word-ladder': {
    variables: ['word', 'next_word', 'length', 'queue'],
    output: '5',
    code: `from collections import deque

def ladder_length(start, target, words):
    remaining = set(words)
    if target not in remaining:
        return 0
    remaining.discard(start)
    queue = deque([[start, 1]])
    while queue:
        word, length = queue.popleft()  # Step: Visit word | All shorter candidate sequences have already been visited.
        if word == target:
            return length
        for index in range(len(word)):
            for letter in "abcdefghijklmnopqrstuvwxyz":
                next_word = word[:index] + letter + word[index + 1:]
                if next_word in remaining:
                    remaining.remove(next_word)
                    queue.append([next_word, length + 1])  # Step: Extend ladder | Enqueue a dictionary word that differs by one letter.
    return 0

print(ladder_length("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]))`,
  },
  'implement-trie-prefix-tree': {
    trie: true,
    variables: ['word', 'prefix', 'letter', 'node'],
    output: 'True\nFalse\nTrue',
    code: `class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        root = self.root
        node = root
        prefix = ""
        for letter in word:
            prefix += letter
            node = node.setdefault(letter, {})  # Step: Extend prefix | Reuse an existing edge for this letter or create one.
        node["#"] = True  # Step: Mark word | A terminal marker distinguishes a complete word from a shared prefix.

    def walk(self, word):
        root = self.root
        node = root
        prefix = ""
        for letter in word:
            if letter not in node:
                return None
            prefix += letter
            node = node[letter]  # Step: Follow edge | Move one letter deeper into the prefix tree.
        return node

    def search(self, word):
        node = self.walk(word)
        return node is not None and "#" in node

    def starts_with(self, prefix):
        return self.walk(prefix) is not None

trie = Trie()
trie.insert("car")
trie.insert("cat")
print(trie.search("car"))
print(trie.search("ca"))
print(trie.starts_with("ca"))`,
  },
  'design-add-and-search-words-data-structure': {
    trie: true,
    variables: ['pattern', 'index', 'letter', 'candidate', 'node'],
    output: 'True\nFalse\nTrue',
    code: `class WordDictionary:
    def __init__(self):
        self.root = {}

    def add_word(self, word):
        root = self.root
        node = root
        for letter in word:
            node = node.setdefault(letter, {})  # Step: Add prefix edge | Share this edge with any earlier word that has the same prefix.
        node["#"] = True

    def search(self, pattern):
        root = self.root

        def match(node, index):
            if index == len(pattern):
                return "#" in node
            letter = pattern[index]
            if letter == ".":
                for candidate in node:
                    if candidate != "#":
                        branch = node[candidate]  # Step: Try wildcard branch | A dot can follow any letter edge at this depth.
                        found = match(branch, index + 1)
                        if found:
                            return True
                return False
            if letter not in node:
                return False
            branch = node[letter]  # Step: Match literal | Follow only the edge for the requested letter.
            return match(branch, index + 1)

        return match(root, 0)

words = WordDictionary()
words.add_word("bad")
words.add_word("bag")
words.add_word("mad")
print(words.search(".ag"))
print(words.search("b.z"))
print(words.search("bad"))`,
  },
  'word-search-ii': {
    grid: 'board',
    variables: ['board', 'word', 'found'],
    output: "['cat', 'tea']",
    code: `def find_words(board, words):
    root = {}
    for word in words:
        node = root
        for letter in word:
            node = node.setdefault(letter, {})
        node["#"] = word
    found = []
    height, width = len(board), len(board[0])

    def visit(row, col, node):
        letter = board[row][col]
        if letter not in node:
            return
        branch = node[letter]
        if "#" in branch:
            word = branch.pop("#")
            found.append(word)  # Step: Record word | The current prefix is a dictionary word. Remove its marker to report it once.
        board[row][col] = "!"  # Step: Mark path cell | Keep the current path from using this square twice.
        for dr, dc in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
            nr, nc = row + dr, col + dc
            if 0 <= nr < height and 0 <= nc < width:
                visit(nr, nc, branch)
        board[row][col] = letter  # Step: Restore path cell | Make the square available to another search path.

    for row in range(height):
        for col in range(width):
            visit(row, col, root)
    return sorted(found)

board = [list("cat"), list("xae")]
print(find_words(board, ["cat", "tea", "car", "atez"]))`,
  },
};
